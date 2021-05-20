import { Db, MongoClient, ObjectId } from "mongodb";
import { defaultAfterAll, defaultAfterEach, defaultBeforeAll, defaultBeforeEach } from "../utilities/setup";
import { BindingBroker } from "../utilities/BindingBroker";
import { RabbitNetworkHandler } from "@uems/micro-builder/build/src";
import bind from "../../src/Binding";
import { BaseSchema, EquipmentMessage, MsgStatus } from "@uems/uemscommlib";
import { EquipmentDatabase } from "../../src/database/EquipmentDatabase";
import Intentions = BaseSchema.Intentions;
import UpdateEquipmentMessage = EquipmentMessage.UpdateEquipmentMessage;
import DeleteEquipmentMessage = EquipmentMessage.DeleteEquipmentMessage;
import ReadEquipmentMessage = EquipmentMessage.ReadEquipmentMessage;
import CreateEquipmentMessage = EquipmentMessage.CreateEquipmentMessage;
// delete works
// delete unknown fails
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
        await defaultBeforeEach([{
            _id: new ObjectId('56d9bf92f9be48771d6fe5b2'),
            assetID: 'abc1',
            name: 'asset name',
            manufacturer: 'asset manufacturer',
            model: 'asset model',
            miscIdentifier: 'asset misc',
            amount: 1,
            location: 'asset location',
            locationSpecifier: 'assert specifier',
            manager: 'asset manager',
            date: 0,
            category: 'asset category',
        }], client, db)
    });
    afterEach(() => defaultAfterEach(client, db));

    it('should allow valid delete instructions', async (done) => {
        broker.emit('delete', {
            ...empty('DELETE'),
            id: '56d9bf92f9be48771d6fe5b2',
        }, 'states.details.delete', (message) => {
            expect(message).toHaveProperty('result');
            expect(message).toHaveProperty('status');

            console.log(message);

            expect(message.status).toEqual(MsgStatus.SUCCESS);
            expect(message.result).toHaveLength(1);
            expect(message.result[0]).toEqual('56d9bf92f9be48771d6fe5b2');

            broker.emit('query', { ...empty('READ') }, 'states.details.read', (read) => {
                expect(read).toHaveProperty('result');
                expect(read).toHaveProperty('status');

                expect(read.status).toEqual(MsgStatus.SUCCESS);
                expect(read.result).toHaveLength(0);

                done();
            });
        });
    });

    it('should reject on invalid delete', async (done) => {
        broker.emit('delete', {
            ...empty('DELETE'),
            id: '56d9bf92f9be48771d6fe5b9',
        }, 'states.details.delete', (message) => {
            expect(message).toHaveProperty('result');
            expect(message).toHaveProperty('status');

            expect(message.status).toEqual(MsgStatus.FAIL);
            expect(message.result).toHaveLength(1);

            broker.emit('query', { ...empty('READ') }, 'states.details.read', (read) => {
                expect(read).toHaveProperty('result');
                expect(read).toHaveProperty('status');

                expect(read.status).toEqual(MsgStatus.SUCCESS);
                expect(read.result).toHaveLength(1);
                expect(read.result[0]).toHaveProperty('id', '56d9bf92f9be48771d6fe5b2');

                done();
            });
        });
    });

});
