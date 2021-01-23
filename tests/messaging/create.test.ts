import { defaultAfterAll, defaultAfterEach, defaultBeforeAll, defaultBeforeEach, haveNoAdditionalKeys } from "../utilities/setup";
import { Db, MongoClient } from "mongodb";
import { BaseSchema } from "@uems/uemscommlib";
import { EquipmentDatabase } from "../../src/database/EquipmentDatabase";
import Intentions = BaseSchema.Intentions;

const empty = <T extends Intentions>(intention: T): { msg_intention: T, msg_id: 0, status: 0, userID: string } => ({
    msg_intention: intention,
    msg_id: 0,
    status: 0,
    userID: 'user',
})

describe('create messages of states', () => {
    let client!: MongoClient;
    let db!: Db;

    beforeAll(async () => {
        const { client: newClient, db: newDb } = await defaultBeforeAll();
        client = newClient;
        db = newDb;

        equipmentDB = new EquipmentDatabase(db, { details: 'details', changelog: 'changelog' });
    });

    afterAll(() => defaultAfterAll(client, db));
    beforeEach(() => defaultBeforeEach([], client, db));
    afterEach(() => defaultAfterEach(client, db));

    let equipmentDB: EquipmentDatabase;

    it('basic create inserts into the database', async () => {
        const result = await equipmentDB.create({
            ...empty('CREATE'),
            name: 'name',
            manufacturer: 'manufacturer',
            model: 'model',
            amount: 1,
            locationID: 'venue',
            category: 'any',
        });

        expect(result).toHaveLength(1);
        expect(typeof (result[0]) === 'string').toBeTruthy();

        const query = await equipmentDB.query({ ...empty('READ') });
        expect(query).toHaveLength(1);
        expect(query[0].name).toEqual('name');
        expect(haveNoAdditionalKeys(query[0], ['id', 'assetID', 'name', 'manufacturer', 'model', 'miscIdentifier', 'amount', 'location', 'locationSpecifier', 'manager', 'date', 'category']));
    });

    it('should not include additional properties in creating records', async () => {
        const result = await equipmentDB.create({
            ...empty('CREATE'),
            name: 'name',
            manufacturer: 'manufacturer',
            model: 'model',
            amount: 1,
            locationID: 'venue',
            category: 'any',
            // @ts-ignore
            addProp: 'one',
            something: 'else',
        });

        expect(result).toHaveLength(1);
        expect(typeof (result[0]) === 'string').toBeTruthy();

        const query = await equipmentDB.query({ ...empty('READ') });
        expect(query).toHaveLength(1);
        expect(query[0].name).toEqual('name');
        expect(haveNoAdditionalKeys(query[0], ['id', 'assetID', 'name', 'manufacturer', 'model', 'miscIdentifier', 'amount', 'location', 'locationSpecifier', 'manager', 'date', 'category']));
    });

    it('should reject creation of duplicate state names', async () => {
        const result = await equipmentDB.create({
            ...empty('CREATE'),
            name: 'name',
            manufacturer: 'manufacturer',
            model: 'model',
            amount: 1,
            locationID: 'venue',
            category: 'any',
            assetID: 'abc1',
        });

        expect(result).toHaveLength(1);
        expect(typeof (result[0]) === 'string').toBeTruthy();

        await expect(equipmentDB.create({
            ...empty('CREATE'),
            name: 'name',
            manufacturer: 'manufacturer',
            model: 'model',
            amount: 1,
            locationID: 'venue',
            category: 'any',
            assetID: 'abc1',
        })).rejects.toThrowError('duplicate asset id');
    });

});
