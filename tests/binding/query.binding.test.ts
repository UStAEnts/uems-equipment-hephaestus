import { Db, MongoClient, ObjectId } from "mongodb";
import { defaultAfterAll, defaultAfterEach, defaultBeforeAll, defaultBeforeEach, haveNoAdditionalKeys } from "../utilities/setup";
import { BindingBroker } from "../utilities/BindingBroker";
import { RabbitNetworkHandler } from "@uems/micro-builder";
import bind from "../../src/Binding";
import { BaseSchema, EquipmentMessage, MsgStatus } from "@uems/uemscommlib";
import { EquipmentDatabase } from "../../src/database/EquipmentDatabase";
import Intentions = BaseSchema.Intentions;
import UpdateEquipmentMessage = EquipmentMessage.UpdateEquipmentMessage;
import DeleteEquipmentMessage = EquipmentMessage.DeleteEquipmentMessage;
import ReadEquipmentMessage = EquipmentMessage.ReadEquipmentMessage;
import CreateEquipmentMessage = EquipmentMessage.CreateEquipmentMessage;

const empty = <T extends Intentions>(intention: T): { msg_intention: T, msg_id: 0, status: 0, userID: string } => ({
    msg_intention: intention,
    msg_id: 0,
    status: 0,
    userID: 'user',
})
// query for invalid returns nothing
// query for id returns one
// empty queries allowed

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
    beforeEach(() => {
        broker.clear();
        bind(equipmentDB, fakeBroker);
        defaultBeforeEach([{
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
        }, {
            _id: new ObjectId('56d9bf92f9be48771d6fe5b3'),
            assetID: 'abc2',
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

    it('should support querying by id', async (done) => {
        broker.emit('query', {
            ...empty('READ'),
            id: '56d9bf92f9be48771d6fe5b3',
        }, 'states.details.read', (message) => {
            expect(message).toHaveProperty('result');
            expect(message).toHaveProperty('status');

            expect(message.status).toEqual(MsgStatus.SUCCESS);
            expect(message.result).toHaveLength(1);

            expect(message.result[0]).toHaveProperty('id', '56d9bf92f9be48771d6fe5b3');
            expect(haveNoAdditionalKeys(message.result[0], ['id', 'assetID', 'name', 'manufacturer', 'model', 'miscIdentifier', 'amount', 'location', 'locationSpecifier', 'manager', 'date', 'category']));

            done();
        })
    });

    it('should support empty queries', async (done) => {
        broker.emit('query', {
            ...empty('READ'),
        }, 'states.details.read', (message) => {
            expect(message).toHaveProperty('result');
            expect(message).toHaveProperty('status');

            expect(message.status).toEqual(MsgStatus.SUCCESS);
            expect(message.result).toHaveLength(2);

            expect(haveNoAdditionalKeys(message.result[0], ['id', 'assetID', 'name', 'manufacturer', 'model', 'miscIdentifier', 'amount', 'location', 'locationSpecifier', 'manager', 'date', 'category']));
            expect(haveNoAdditionalKeys(message.result[1], ['id', 'assetID', 'name', 'manufacturer', 'model', 'miscIdentifier', 'amount', 'location', 'locationSpecifier', 'manager', 'date', 'category']));

            done();
        })
    });

});
