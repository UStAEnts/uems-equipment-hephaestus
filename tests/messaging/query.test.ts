// should return return all when query is empty
// should return onyl valid properties
// should only return one matching entry when querying by ID
// query by substring works
// query by invalid id returns no result

import { Db, MongoClient, ObjectId } from "mongodb";
import { defaultAfterAll, defaultAfterEach, defaultBeforeAll, defaultBeforeEach, haveNoAdditionalKeys } from "../utilities/setup";
import { BaseSchema } from "@uems/uemscommlib";
import { EquipmentDatabase } from "../../src/database/EquipmentDatabase";
import Intentions = BaseSchema.Intentions;

const empty = <T extends Intentions>(intention: T): { msg_intention: T, msg_id: 0, status: 0, userID: string } => ({
    msg_intention: intention,
    msg_id: 0,
    status: 0,
    userID: 'user',
})

describe('delete messages of states', () => {
    let client!: MongoClient;
    let db!: Db;

    beforeAll(async () => {
        const { client: newClient, db: newDb } = await defaultBeforeAll();
        client = newClient;
        db = newDb;

        equipmentDB = new EquipmentDatabase(db, { details: 'details', changelog: 'changelog' });
    });

    afterAll(() => defaultAfterAll(client, db));
    beforeEach(() => defaultBeforeEach([{
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
        name: 'asset version two name',
        manufacturer: 'asset manufacturer',
        model: 'asset model',
        miscIdentifier: 'asset misc',
        amount: 1,
        location: 'asset location',
        locationSpecifier: 'assert specifier',
        manager: 'asset manager',
        date: 0,
        category: 'asset category',
    }], client, db));
    afterEach(() => defaultAfterEach(client, db));

    let equipmentDB: EquipmentDatabase;

    it('should return return all when query is empty', async () => {
        const query = await equipmentDB.query({ ...empty('READ') });
        expect(query).toHaveLength(2);
        let find = query.find((e) => e.id === '56d9bf92f9be48771d6fe5b2');
        expect(find).not.toBeUndefined();
        expect(find).toHaveProperty('id', '56d9bf92f9be48771d6fe5b2');
        expect(find).toHaveProperty('assetID', 'abc1');

        find = query.find((e) => e.id === '56d9bf92f9be48771d6fe5b3');
        expect(find).not.toBeUndefined();
        expect(find).toHaveProperty('id', '56d9bf92f9be48771d6fe5b3');
        expect(find).toHaveProperty('assetID', 'abc2');
    });

    it('should return only valid properties', async () => {
        const query = await equipmentDB.query({ ...empty('READ'), id: '56d9bf92f9be48771d6fe5b2' });
        expect(query).toHaveLength(1);
        expect(haveNoAdditionalKeys(query[0], ['id', 'assetID', 'name', 'manufacturer', 'model', 'miscIdentifier', 'amount', 'location', 'locationSpecifier', 'manager', 'date', 'category']));
    });

    it('query by substring works', async () => {
        const query = await equipmentDB.query({ ...empty('READ'), name: 'two' });
        expect(query).toHaveLength(1);
        expect(query[0]).toHaveProperty('id', '56d9bf92f9be48771d6fe5b3');
        expect(query[0]).toHaveProperty('assetID', 'abc2');
    });

    it('query by invalid id returns no result', async () => {
        const query = await equipmentDB.query({ ...empty('READ'), id: '56d9bf92f9be48771d6fe5b9' });
        expect(query).toHaveLength(0);
    });

});
