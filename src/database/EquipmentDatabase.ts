import { Collection, ObjectId } from "mongodb";
import { GenericMongoDatabase } from "@uems/micro-builder";
import { EquipmentMessage, EquipmentResponse } from "@uems/uemscommlib";
import ReadEquipmentMessage = EquipmentMessage.ReadEquipmentMessage;
import CreateEquipmentMessage = EquipmentMessage.CreateEquipmentMessage;
import DeleteEquipmentMessage = EquipmentMessage.DeleteEquipmentMessage;
import UpdateEquipmentMessage = EquipmentMessage.UpdateEquipmentMessage;
import { EquipmentValidators } from "@uems/uemscommlib/build/equipment/EquipmentValidators";
import EquipmentRepresentation = EquipmentValidators.EquipmentRepresentation;
import InternalEquipment = EquipmentResponse.InternalEquipment;

export class EquipmentDatabase extends GenericMongoDatabase<ReadEquipmentMessage, CreateEquipmentMessage, DeleteEquipmentMessage, UpdateEquipmentMessage, EquipmentRepresentation> {

    protected async createImpl(create: EquipmentMessage.CreateEquipmentMessage, details: Collection): Promise<string[]> {
        const { msg_id, msg_intention, status, ...document } = create;

        const result = await details.insertOne(document);

        if (result.insertedCount !== 1 || result.insertedId === undefined) {
            throw new Error('failed to insert')
        }

        const id = (result.insertedId as ObjectId).toHexString();
        await super.log(id, 'inserted');

        return [id];
    }

    protected deleteImpl(remove: EquipmentMessage.DeleteEquipmentMessage): Promise<string[]> {
        return super.defaultDelete(remove);
    }

    protected async queryImpl(query: EquipmentMessage.ReadEquipmentMessage, details: Collection): Promise<EquipmentValidators.EquipmentRepresentation[]> {
        const find: Record<string, unknown> = {};

        // IDs have to be treated as object IDs
        if (query.id) {
            if (!ObjectId.isValid(query.id)) throw new Error('invalid query id');
            find._id = new ObjectId(query.id);
        }

        // For now group all the text fields into one and perform a full text search.
        // This might not work properly, we'll need to see
        const text = [];
        for (const entry of ['assertID', 'name', 'manufacturer', 'model', 'miscIdentifier', 'locationSpecifier', 'category'] as (keyof ReadEquipmentMessage)[]){
            if (query[entry] !== undefined) text.push(query[entry]);
        }

        if (text.length > 0){
            // TODO: find a way to search by column rather than relying on a single text index
            find.$text = {
                $search: text.join(' '),
            }
        }

        // Copy all remaining search properties into the query if they have been specified
        const remainingProperties = ['amount', 'locationID', 'managerID', 'date'] as (keyof ReadEquipmentMessage)[];
        for (const entry of remainingProperties){
            if (query[entry] !== undefined){
                find[entry] = query[entry];
            }
        }

        const result: InternalEquipment[] = await details.find(find).toArray();

        // Copy _id to id to fit the responsr type.
        for (const r of result) {
            // @ts-ignore
            r.id = r._id.toString();

            // @ts-ignore
            delete r._id;
        }

        return result;
    }

    protected updateImpl(update: EquipmentMessage.UpdateEquipmentMessage): Promise<string[]> {
        return super.defaultUpdate(update)
    }

}
