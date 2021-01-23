// basic
// adding properties does not work
// no changes should not work

import { Db, MongoClient, ObjectId } from "mongodb";
import { defaultAfterAll, defaultAfterEach, defaultBeforeAll, defaultBeforeEach } from "../utilities/setup";
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

    it('should allow updates', async () => {
        const update = await equipmentDB.update({
            ...empty('UPDATE'),
            locationID: 'updated location',
            name: 'new name',
            id: '56d9bf92f9be48771d6fe5b2',
        });
        expect(update).toHaveLength(1);
        expect(update).toEqual(['56d9bf92f9be48771d6fe5b2']);

        const query = await equipmentDB.query({ ...empty('READ') });
        expect(query).toHaveLength(2);
        let find = query.find((e) => e.id === '56d9bf92f9be48771d6fe5b2');
        expect(find).not.toBeUndefined();
        expect(find).toHaveProperty('id', '56d9bf92f9be48771d6fe5b2');
        expect(find).toHaveProperty('assetID', 'abc1');
        expect(find).toHaveProperty('location', 'updated location');
        expect(find).toHaveProperty('name', 'new name');


        find = query.find((e) => e.id === '56d9bf92f9be48771d6fe5b3');
        expect(find).not.toBeUndefined();
        expect(find).toHaveProperty('id', '56d9bf92f9be48771d6fe5b3');
        expect(find).toHaveProperty('assetID', 'abc2');
        expect(find).toHaveProperty('location', 'asset location');
        expect(find).toHaveProperty('name', 'asset version two name');
    });

    it('should reject updates with an invalid ID', async () => {
        await expect(equipmentDB.update({
            ...empty('UPDATE'),
            name: 'new name',
            id: '56d9bf92f9be48771d6fe5b9',
        })).rejects.toThrowError('invalid entity ID');

        const query = await equipmentDB.query({ ...empty('READ') });
        expect(query).toHaveLength(2);
        let find = query.find((e) => e.id === '56d9bf92f9be48771d6fe5b2');
        expect(find).not.toBeUndefined();
        expect(find).toHaveProperty('id', '56d9bf92f9be48771d6fe5b2');
        expect(find).toHaveProperty('assetID', 'abc1');
        expect(find).toHaveProperty('location', 'asset location');
        expect(find).toHaveProperty('name', 'asset name');


        find = query.find((e) => e.id === '56d9bf92f9be48771d6fe5b3');
        expect(find).not.toBeUndefined();
        expect(find).toHaveProperty('id', '56d9bf92f9be48771d6fe5b3');
        expect(find).toHaveProperty('assetID', 'abc2');
        expect(find).toHaveProperty('location', 'asset location');
        expect(find).toHaveProperty('name', 'asset version two name');
    });

    it('should reject with no operations', async () => {
        await expect(equipmentDB.update({
            ...empty('UPDATE'),
            id: '56d9bf92f9be48771d6fe5b3',
        })).rejects.toThrowError('no operations provided');

        const query = await equipmentDB.query({ ...empty('READ') });
        expect(query).toHaveLength(2);
        let find = query.find((e) => e.id === '56d9bf92f9be48771d6fe5b2');
        expect(find).not.toBeUndefined();
        expect(find).toHaveProperty('id', '56d9bf92f9be48771d6fe5b2');
        expect(find).toHaveProperty('assetID', 'abc1');
        expect(find).toHaveProperty('location', 'asset location');
        expect(find).toHaveProperty('name', 'asset name');


        find = query.find((e) => e.id === '56d9bf92f9be48771d6fe5b3');
        expect(find).not.toBeUndefined();
        expect(find).toHaveProperty('id', '56d9bf92f9be48771d6fe5b3');
        expect(find).toHaveProperty('assetID', 'abc2');
        expect(find).toHaveProperty('location', 'asset location');
        expect(find).toHaveProperty('name', 'asset version two name');
    });

    it('should not allow changing additional properties via update', async () => {
        await expect(equipmentDB.update({
            ...empty('UPDATE'),
            id: '56d9bf92f9be48771d6fe5b2',
            name: 'new name',
            // @ts-ignore
            add: 'adding a property',
        })).resolves.toEqual(['56d9bf92f9be48771d6fe5b2']);

        const query = await equipmentDB.query({ ...empty('READ') });
        expect(query).toHaveLength(2);
        let find = query.find((e) => e.id === '56d9bf92f9be48771d6fe5b2');
        expect(find).not.toBeUndefined();
        expect(find).toHaveProperty('id', '56d9bf92f9be48771d6fe5b2');
        expect(find).toHaveProperty('assetID', 'abc1');
        expect(find).toHaveProperty('location', 'asset location');
        expect(find).toHaveProperty('name', 'new name');


        find = query.find((e) => e.id === '56d9bf92f9be48771d6fe5b3');
        expect(find).not.toBeUndefined();
        expect(find).toHaveProperty('id', '56d9bf92f9be48771d6fe5b3');
        expect(find).toHaveProperty('assetID', 'abc2');
        expect(find).toHaveProperty('location', 'asset location');
        expect(find).toHaveProperty('name', 'asset version two name');
    });

    it('should not allow updating to existing asset id', async () => {
        await expect(equipmentDB.update({
            ...empty('UPDATE'),
            id: '56d9bf92f9be48771d6fe5b2',
            assetID: 'abc2'
        })).rejects.toThrowError('cannot update to existing asset id');

        const query = await equipmentDB.query({ ...empty('READ') });
        expect(query).toHaveLength(2);
        let find = query.find((e) => e.id === '56d9bf92f9be48771d6fe5b2');
        expect(find).not.toBeUndefined();
        expect(find).toHaveProperty('id', '56d9bf92f9be48771d6fe5b2');
        expect(find).toHaveProperty('assetID', 'abc1');
        expect(find).toHaveProperty('location', 'asset location');
        expect(find).toHaveProperty('name', 'asset name');


        find = query.find((e) => e.id === '56d9bf92f9be48771d6fe5b3');
        expect(find).not.toBeUndefined();
        expect(find).toHaveProperty('id', '56d9bf92f9be48771d6fe5b3');
        expect(find).toHaveProperty('assetID', 'abc2');
        expect(find).toHaveProperty('location', 'asset location');
        expect(find).toHaveProperty('name', 'asset version two name');
    });
});
