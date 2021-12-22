import {constants} from "http2";
import {EquipmentDatabase} from "./database/EquipmentDatabase";
import {_ml} from "./logging/Log";
import {DiscoveryMessage, DiscoveryResponse, EquipmentMessage, EquipmentResponse, MsgStatus} from "@uems/uemscommlib";
import {ClientFacingError, RabbitNetworkHandler, tryApplyTrait} from "@uems/micro-builder/build/src";

const _b = _ml(__filename, 'binding');

const requestTracker: ('success' | 'fail')[] = [];

const saveRequest = (result: 'success' | 'fail') => {
    if (requestTracker.length >= 50) requestTracker.shift();
    requestTracker.push(result);

    tryApplyTrait('successful', requestTracker.filter((e) => e === 'success').length);
    tryApplyTrait('fail', requestTracker.filter((e) => e === 'fail').length);
}

async function discover(
    message: DiscoveryMessage.DiscoverMessage,
    database: EquipmentDatabase,
    send: (res: any) => void) {

    if (message.assetType === 'venue') {
        const result = await database.query({
            locationID: message.assetID,
            ...message,
        });
        send({
            userID: message.userID,
            status: MsgStatus.SUCCESS,
            msg_id: message.msg_id,
            msg_intention: message.msg_intention,
            modify: 0,
            restrict: result.length,
        });
    } else if (message.assetType === 'user') {
        const result = await database.query({
            managerID: message.assetID,
            ...message,
        });
        send({
            userID: message.userID,
            status: MsgStatus.SUCCESS,
            msg_id: message.msg_id,
            msg_intention: message.msg_intention,
            modify: 0,
            restrict: result.length,
        });
    } else if (message.assetType === 'equipment') {
        const result = await database.query({id: message.assetID, ...message});
        send({
            userID: message.userID,
            status: MsgStatus.SUCCESS,
            msg_id: message.msg_id,
            msg_intention: message.msg_intention,
            modify: result.length,
            restrict: 0,
        });
    } else {
        send({
            userID: message.userID,
            status: MsgStatus.SUCCESS,
            msg_id: message.msg_id,
            msg_intention: message.msg_intention,
            modify: 0,
            restrict: 0,
        })
        return;
    }
}

async function remove(
    message: DiscoveryMessage.DeleteMessage,
    database: EquipmentDatabase,
    send: (res: any) => void) {

    let length = 0;
    if (message.assetType === 'equipment') {
        length = (await database.delete({
            userID: 'anonymous',
            msg_id: message.msg_id,
            msg_intention: 'DELETE',
            status: 0,
            id: message.assetID
        })).length;
    }

    send({
        userID: message.userID,
        status: MsgStatus.SUCCESS,
        msg_id: message.msg_id,
        msg_intention: "DELETE",
        restrict: 0,
        modified: length,
        successful: true,
    });
}

async function execute(
    message: EquipmentMessage.EquipmentMessage,
    database: EquipmentDatabase | undefined,
    send: (res: EquipmentResponse.EquipmentResponseMessage | EquipmentResponse.EquipmentReadResponseMessage) => void,
) {
    if (!database) {
        _b.warn('query was received without a valid database connection');
        saveRequest('fail');
        throw new Error('uninitialised database connection');
    }

    let status: number = constants.HTTP_STATUS_INTERNAL_SERVER_ERROR;
    let result: string[] | EquipmentResponse.InternalEquipment[] = [];

    try {
        switch (message.msg_intention) {
            case 'CREATE':
                result = await database.create(message);
                status = MsgStatus.SUCCESS;
                break;
            case 'DELETE':
                result = await database.delete(message);
                status = MsgStatus.SUCCESS;
                break;
            case 'READ':
                result = await database.query(message);
                status = MsgStatus.SUCCESS;
                break;
            case 'UPDATE':
                result = await database.update(message);
                status = MsgStatus.SUCCESS;
                break;
            default:
                status = constants.HTTP_STATUS_NOT_IMPLEMENTED;
        }
    } catch (e) {
        _b.error('failed to query database for events', {
            error: e as unknown,
        });
        saveRequest('fail');

        if (e instanceof ClientFacingError) {
            send({
                userID: message.userID,
                status: MsgStatus.FAIL,
                msg_id: message.msg_id,
                msg_intention: message.msg_intention,
                result: [e.message],
            });
            return;
        } else {
            send({
                userID: message.userID,
                status: constants.HTTP_STATUS_INTERNAL_SERVER_ERROR,
                msg_id: message.msg_id,
                msg_intention: message.msg_intention,
                result: ['internal server error'],
            });
            return;
        }
    }

    if (message.msg_intention === 'READ') {
        send({
            msg_intention: message.msg_intention,
            msg_id: message.msg_id,
            status,
            result: result as EquipmentResponse.InternalEquipment[],
            userID: message.userID,
        });
    } else {
        send({
            msg_intention: message.msg_intention,
            msg_id: message.msg_id,
            status,
            result: result as string[],
            userID: message.userID,
        });
    }

    saveRequest('success');
}

export default function bind(database: EquipmentDatabase, broker: RabbitNetworkHandler<any, any, any, any, any, any>): void {
    broker.on('query', (message, send, routingKey) => {
        if (routingKey.endsWith('.discover')) return discover(message, database, send);
        else if (routingKey.endsWith('.delete')) return remove(message, database, send);
        else return execute(message, database, send)
    });
    _b.debug('bound [query] event');

    broker.on('delete', (message, send) => execute(message, database, send));
    _b.debug('bound [delete] event');

    broker.on('update', (message, send) => execute(message, database, send));
    _b.debug('bound [update] event');

    broker.on('create', (message, send) => execute(message, database, send));
    _b.debug('bound [create] event');
}
