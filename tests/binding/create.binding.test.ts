import { Db, MongoClient } from "mongodb";
import { defaultAfterAll, defaultAfterEach, defaultBeforeAll, defaultBeforeEach } from "../utilities/setup";
import { BindingBroker } from "../utilities/BindingBroker";
import { RabbitNetworkHandler } from "@uems/micro-builder";
import bind from "../../src/Binding";
import { BaseSchema, EquipmentMessage, MsgStatus } from "@uems/uemscommlib";
import { EquipmentDatabase } from "../../src/database/EquipmentDatabase";
import Intentions = BaseSchema.Intentions;
import ReadEquipmentMessage = EquipmentMessage.ReadEquipmentMessage;
import DeleteEquipmentMessage = EquipmentMessage.DeleteEquipmentMessage;
import UpdateEquipmentMessage = EquipmentMessage.UpdateEquipmentMessage;
import CreateEquipmentMessage = EquipmentMessage.CreateEquipmentMessage;
// creating normal works
// creating duplicate fails
// undefined db fails successfully

const empty = <T extends Intentions>(intention: T): { msg_intention: T, msg_id: 0, status: 0, userID: string } => ({
    msg_intention: intention,
    msg_id: 0,
    status: 0,
    userID: 'user',
})

describe('create messages of states', () => {
    let client!: MongoClient;
    let db!: Db;

    let broker!: BindingBroker<ReadEquipmentMessage, DeleteEquipmentMessage, UpdateEquipmentMessage, CreateEquipmentMessage, EquipmentMessage.EquipmentMessage>;
    let fakeBroker!: RabbitNetworkHandler<any, any, any, any, any, any>;

    let equipmentDB: EquipmentDatabase;

    beforeAll(async () => {
        const { client: newClient, db: newDb } = await defaultBeforeAll();
        client = newClient;
        db = newDb;

        broker = new BindingBroker();
        fakeBroker = broker as unknown as RabbitNetworkHandler<any, any, any, any, any, any>;

        equipmentDB = new EquipmentDatabase(db, { details: 'details', changelog: 'changelog' });
    });
    afterAll(() => defaultAfterAll(client, db));
    beforeEach(async () => {
        await broker.clear();
        await bind(equipmentDB, fakeBroker);
        await defaultBeforeEach([], client, db)
    });
    afterEach(() => defaultAfterEach(client, db));

    it('should allow creates to take place', async (done) => {
        broker.emit('create', {
            ...empty('CREATE'),
            name: 'name',
            manufacturer: 'manufacturer',
            model: 'model',
            amount: 1,
            locationID: 'venue',
            category: 'any',
        }, 'equipment.details.create', (creation) => {
            expect(creation).toHaveProperty('result');
            expect(creation).toHaveProperty('status');

            expect(creation.status).toEqual(MsgStatus.SUCCESS);
            expect(creation.result).toHaveLength(1);

            broker.emit('query', { ...empty('READ'), id: creation.result[0] }, 'equipment.details.read', (data) => {
                expect(data).toHaveProperty('result');
                expect(data).toHaveProperty('status');

                expect(data.status).toEqual(MsgStatus.SUCCESS);
                expect(data.result).toHaveLength(1);
                expect(data.result[0]).toHaveProperty('name', 'name');
                expect(data.result[0]).toHaveProperty('manufacturer', 'manufacturer');
                expect(data.result[0]).toHaveProperty('model', 'model');
                expect(data.result[0]).toHaveProperty('amount', 1);
                expect(data.result[0]).toHaveProperty('location', 'venue');
                expect(data.result[0]).toHaveProperty('category', 'any');

                done();
            });
        });
    });

    it('should prevent creating duplicate entries', async (done) => {
        broker.emit('create', {
            ...empty('CREATE'),
            name: 'name',
            manufacturer: 'manufacturer',
            model: 'model',
            amount: 1,
            locationID: 'venue',
            category: 'any',
            assetID: 'abc',
        }, 'equipment.details.create', (creation) => {
            expect(creation).toHaveProperty('result');
            expect(creation).toHaveProperty('status');

            expect(creation.status).toEqual(MsgStatus.SUCCESS);
            expect(creation.result).toHaveLength(1);

            broker.emit('create', {
                ...empty('CREATE'),
                name: 'diff name',
                manufacturer: 'diff manufacturer',
                model: 'diff model',
                amount: 1,
                locationID: 'diff venue',
                category: 'diff any',
                assetID: 'abc',
            }, 'equipment.details.create', (second) => {
                expect(second).toHaveProperty('result');
                expect(second).toHaveProperty('status');

                expect(second.status).toEqual(MsgStatus.FAIL);
                expect(second.result).toHaveLength(1);
                expect(second.result[0]).toContain('duplicate');

                done();
            });
        });
    });

    it('should fail gracefully if the database is dead', async (done) => {
        let db: EquipmentDatabase = new Proxy(equipmentDB, {
            get(target: EquipmentDatabase, p: PropertyKey, receiver: any): any {
                throw new Error('proxied database throwing error');
            },
        });

        broker.clear();
        bind(db, fakeBroker);

        broker.emit('create', {
            ...empty('CREATE'),
            name: 'name',
            manufacturer: 'manufacturer',
            model: 'model',
            amount: 1,
            locationID: 'venue',
            category: 'any',
        }, 'equipment.details.create', (message) => {
            expect(message).toHaveProperty('result');
            expect(message).toHaveProperty('status');

            expect(message.result).toHaveLength(1);
            expect(message.status).not.toEqual(MsgStatus.SUCCESS);
            expect(message.result[0]).toEqual('internal server error');

            done();
        });
    });

});
