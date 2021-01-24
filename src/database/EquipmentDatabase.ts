import { Collection, Db, FilterQuery, ObjectId, UpdateQuery } from "mongodb";
import { GenericMongoDatabase, MongoDBConfiguration } from "@uems/micro-builder";
import { EquipmentMessage, EquipmentResponse } from "@uems/uemscommlib";
import { genericCreate, genericDelete, genericEntityConversion, genericUpdate } from "@uems/micro-builder/build/utility/GenericDatabaseFunctions";
import { ClientFacingError } from "@uems/micro-builder/build/errors/ClientFacingError";
import ReadEquipmentMessage = EquipmentMessage.ReadEquipmentMessage;
import CreateEquipmentMessage = EquipmentMessage.CreateEquipmentMessage;
import DeleteEquipmentMessage = EquipmentMessage.DeleteEquipmentMessage;
import UpdateEquipmentMessage = EquipmentMessage.UpdateEquipmentMessage;
import InternalEquipment = EquipmentResponse.InternalEquipment;

type InDatabaseEquipment = {
    _id: ObjectId,
    assetID?: string,
    name: string,
    manufacturer: string,
    model: string,
    miscIdentifier?: string,
    amount: number,
    location: string,
    locationSpecifier?: string,
    manager: string,
    date: number,
    category: string,
}

type CreateInDatabaseEquipment = Omit<InDatabaseEquipment, '_id'>;

const dbToIn = (data: InDatabaseEquipment): InternalEquipment => genericEntityConversion(
    data,
    {
        manufacturer: 'manufacturer',
        _id: 'id',
        date: 'date',
        name: 'name',
        assetID: 'assetID',
        category: 'category',
        manager: 'manager',
        amount: 'amount',
        location: 'location',
        locationSpecifier: 'locationSpecifier',
        miscIdentifier: 'miscIdentifier',
        model: 'model',
    },
    '_id',
);

const createToDb = (data: CreateEquipmentMessage): CreateInDatabaseEquipment => ({
    ...genericEntityConversion(
        data,
        {
            model: 'model',
            miscIdentifier: 'miscIdentifier',
            locationSpecifier: 'locationSpecifier',
            amount: 'amount',
            category: 'category',
            assetID: 'assetID',
            name: 'name',
            manufacturer: 'manufacturer',
            locationID: 'location',
            userID: 'manager',
        }
    ),
    date: Date.now(),
})

export class EquipmentDatabase extends GenericMongoDatabase<ReadEquipmentMessage, CreateEquipmentMessage, DeleteEquipmentMessage, UpdateEquipmentMessage, InternalEquipment> {


    constructor(_configuration: MongoDBConfiguration);
    constructor(_configurationOrDB: MongoDBConfiguration | Db, collections?: MongoDBConfiguration["collections"]);
    constructor(database: Db, collections: MongoDBConfiguration["collections"]);
    constructor(_configuration: MongoDBConfiguration | Db, collections?: MongoDBConfiguration["collections"]) {
        super(_configuration, collections);

        const register = (details: Collection) => {
            void details.createIndex({ assetID: 1 }, { unique: true });
            void details.createIndex({
                assertID: 'text',
                name: 'text',
                manufacturer: 'text',
                model: 'text',
                miscIdentifier: 'text',
                locationSpecifier: 'text',
                category: 'text'
            });
        };

        if (this._details) {
            register(this._details);
        } else {
            this.once('ready', () => {
                if (!this._details) throw new Error('Details db was not initialised on ready');
                register(this._details);
            });
        }
    }

    protected async createImpl(create: EquipmentMessage.CreateEquipmentMessage, details: Collection): Promise<string[]> {
        // const { msg_id, msg_intention, status, ...document } = create;
        //
        // const result = await details.insertOne(document);
        //
        // if (result.insertedCount !== 1 || result.insertedId === undefined) {
        //     throw new Error('failed to insert')
        // }
        //
        // const id = (result.insertedId as ObjectId).toHexString();
        // await this.log(id, 'inserted');
        //
        // return [id];
        return genericCreate(create, createToDb, details, () => {
            throw new ClientFacingError('duplicate asset id');
        }, this.log.bind(this));
    }

    protected deleteImpl(remove: EquipmentMessage.DeleteEquipmentMessage, details: Collection): Promise<string[]> {
        return genericDelete<InDatabaseEquipment>({
            _id: new ObjectId(remove.id),
        }, remove.id, details, this.log.bind(this));
    }

    protected async queryImpl(query: EquipmentMessage.ReadEquipmentMessage, details: Collection): Promise<InternalEquipment[]> {
        const find: Record<string, unknown> = {};

        // IDs have to be treated as object IDs
        if (query.id) {
            if (!ObjectId.isValid(query.id)) throw new Error('invalid query id');
            find._id = new ObjectId(query.id);
        }

        // For now group all the text fields into one and perform a full text search.
        // This might not work properly, we'll need to see
        const text = [];
        for (const entry of ['name', 'manufacturer', 'model', 'miscIdentifier', 'locationSpecifier', 'category'] as (keyof ReadEquipmentMessage)[]) {
            if (query[entry] !== undefined) text.push(query[entry]);
        }

        if (text.length > 0) {
            // TODO: find a way to search by column rather than relying on a single text index
            find.$text = {
                $search: text.join(' '),
            }
        }

        // Copy all remaining search properties into the query if they have been specified
        const remainingProperties = ['assetID', 'amount', 'locationID', 'managerID', 'date'] as (keyof ReadEquipmentMessage)[];
        for (const entry of remainingProperties) {
            if (query[entry] !== undefined) {
                find[entry] = query[entry];
            }
        }

        return (await details.find(find).toArray()).map(dbToIn);
    }

    protected async updateImpl(update: EquipmentMessage.UpdateEquipmentMessage, details: Collection): Promise<string[]> {
        const filter: FilterQuery<InDatabaseEquipment> = {
            _id: new ObjectId(update.id),
        };

        const changes: UpdateQuery<InDatabaseEquipment> = {
            $set: {
                ...(update.locationID ? { location: update.locationID } : undefined),
                ...(update.manufacturer ? { manufacturer: update.manufacturer } : undefined),
                ...(update.name ? { name: update.name } : undefined),
                ...(update.assetID ? { assetID: update.assetID } : undefined),
                ...(update.category ? { category: update.category } : undefined),
                ...(update.amount ? { amount: update.amount } : undefined),
                ...(update.locationSpecifier ? { locationSpecifier: update.locationSpecifier } : undefined),
                ...(update.miscIdentifier ? { miscIdentifier: update.miscIdentifier } : undefined),
                ...(update.model ? { model: update.model } : undefined),
                ...(update.managerID ? { manager: update.managerID } : undefined),
            },
        }

        if (Object.keys(changes.$set ?? {}).length === 0) {
            throw new ClientFacingError('no operations provided');
        }

        let result;
        try {
            result = await details.updateOne(filter, changes);
        } catch (e) {
            if (e.code === 11000) {
                throw new ClientFacingError('cannot update to existing asset id');
            }

            throw e;
        }

        if (result.matchedCount === 0) {
            throw new ClientFacingError('invalid entity ID');
        }

        if (result.result.ok !== 1) {
            throw new Error('failed to update');
        }

        return [update.id];
    }

}
