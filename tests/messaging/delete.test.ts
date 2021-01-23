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
    }], client, db));
    afterEach(() => defaultAfterEach(client, db));

    let equipmentDB: EquipmentDatabase;

    it('should allow basic deletes to perform successfully', async () => {
        const id = '56d9bf92f9be48771d6fe5b2';
        const remove = await equipmentDB.delete({ ...empty('DELETE'), id });
        expect(remove).toHaveLength(1);
        expect(remove).toEqual([id]);

        const query = await equipmentDB.query(empty('READ'));
        expect(query).toHaveLength(0);
    });

    it('should reject when deleting with a non-existent id', async () => {
        const id = '56d9bf92f9be48771d6fe5b9';
        await expect(equipmentDB.delete({ ...empty('DELETE'), id })).rejects.toThrowError('invalid entity ID');

        const query = await equipmentDB.query(empty('READ'));
        expect(query).toHaveLength(1);
    });

    it('should support deleting with additional properties', async () => {
        const id = '56d9bf92f9be48771d6fe5b2';
        // @ts-ignore
        const remove = await equipmentDB.delete({ ...empty('DELETE'), id, other: 'additional' });
        expect(remove).toHaveLength(1);
        expect(remove).toEqual([id]);

        const query = await equipmentDB.query(empty('READ'));
        expect(query).toHaveLength(0);
    });

});
