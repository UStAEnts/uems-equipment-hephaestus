import { _ml, setupGlobalLogger } from './logging/Log';

setupGlobalLogger();
const __ = _ml(__filename);

import fs from 'fs/promises';
import path from 'path';
import * as z from 'zod';
import { EquipmentDatabase } from "./database/EquipmentDatabase";
import bind from "./Binding";
import {EquipmentMessage as EM, EquipmentResponse as ER, EquipmentMessageValidator, EquipmentResponseValidator} from "@uems/uemscommlib";
import { ConfigurationSchema } from "./ConfigurationTypes";
import { launchCheck, RabbitNetworkHandler, tryApplyTrait } from "@uems/micro-builder/build/src";

__.info('starting hephaestus...');

let messager: RabbitNetworkHandler<any, any, any, any, any, any> | undefined;
let database: EquipmentDatabase | undefined;
let configuration: z.infer<typeof ConfigurationSchema> | undefined;

fs.readFile(path.join(__dirname, '..', '..', 'config', 'configuration.json'), { encoding: 'utf8' })
    .then((file) => {
        __.debug('loaded configuration file');

        configuration = ConfigurationSchema.parse(JSON.parse(file));
    })
    .then(() => (new Promise<EquipmentDatabase>((resolve, reject) => {
        if (!configuration) {
            __.error('reached an uninitialised configuration, this should not be possible');
            reject(new Error('uninitialised configuration'));
            return;
        }

        __.info('setting up database connection');

        database = new EquipmentDatabase(configuration.database);

        const unbind = database.once('error', (err) => {
            __.error('failed to setup the database connection', {
                error: err,
            });

            reject(err);
        });

        database.once('ready', () => {
            __.info('database connection enabled');
            // Make sure we dont later try and reject a resolved promise from an unrelated error
            unbind();

            if (database) resolve(database);
            else reject(new Error('database is invalid'));
        });
    })))
    .then(() => (new Promise<void>((resolve, reject) => {
        if (!configuration) {
            __.error('reached an uninitialised configuration, this should not be possible');
            reject(new Error('uninitialised configuration'));
            return;
        }

        __.info('setting up the message broker');

        messager = new RabbitNetworkHandler<EM.EquipmentMessage,
            EM.CreateEquipmentMessage,
            EM.DeleteEquipmentMessage,
            EM.ReadEquipmentMessage,
            EM.UpdateEquipmentMessage,
            ER.EquipmentReadResponseMessage | ER.EquipmentResponseMessage>
        (
            configuration.message,
            (data) => new EquipmentMessageValidator().validate(data),
            (data) => new EquipmentResponseValidator().validate(data),
        );

        const unbind = messager.once('error', (err) => {
            __.error('failed to setup the message broker', {
                error: err,
            });

            reject(err);
        });

        messager.once('ready', () => {
            __.info('message broker enabled');
            // Make sure we dont later try and reject a resolved promise from an unrelated error
            unbind();
            resolve();
        });
    })))
    .then(() => {
        if (!messager || !database) {
            __.error('reached an uninitialised database or messenger, this should not be possible');
            throw new Error('uninitialised database or messenger');
        }

        __.info('binding database to messenger');

        bind(database, messager);

        // We're ready to start!
        __.info('hera up and running');
    })
    .catch((err) => {
        __.error('failed to launch', {
            error: err as unknown,
        });
    });
