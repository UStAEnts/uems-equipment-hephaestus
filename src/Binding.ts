import { constants } from "http2";
import { EquipmentDatabase } from "./database/EquipmentDatabase";
import { _ml } from "./logging/Log";
import { EquipmentMessage, EquipmentResponse, MsgStatus } from "@uems/uemscommlib";
import { ClientFacingError, RabbitNetworkHandler, tryApplyTrait } from "@uems/micro-builder/build/src";

const _b = _ml(__filename, 'binding');

async function execute(
    message: EquipmentMessage.EquipmentMessage,
    database: EquipmentDatabase | undefined,
    send: (res: EquipmentResponse.EquipmentResponseMessage | EquipmentResponse.EquipmentReadResponseMessage) => void,
) {
    if (!database) {
        _b.warn('query was received without a valid database connection');
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
}

export default function bind(database: EquipmentDatabase, broker: RabbitNetworkHandler<any, any, any, any, any, any>): void {
    broker.on('query', (message, send) => execute(message, database, send));
    _b.debug('bound [query] event');

    broker.on('delete', (message, send) => execute(message, database, send));
    _b.debug('bound [delete] event');

    broker.on('update', (message, send) => execute(message, database, send));
    _b.debug('bound [update] event');

    broker.on('create', (message, send) => execute(message, database, send));
    _b.debug('bound [create] event');
}
