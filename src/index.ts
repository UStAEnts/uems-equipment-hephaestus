import {_ml, setupGlobalLogger} from './logging/Log';
import fs from 'fs/promises';
import path from 'path';
import * as z from 'zod';
import {EquipmentDatabase} from "./database/EquipmentDatabase";
import bind from "./Binding";
import {
    DiscoveryMessage, DiscoveryResponse,
    EquipmentMessage as EM,
    EquipmentMessageValidator,
    EquipmentResponse as ER,
    EquipmentResponseValidator,
    has
} from "@uems/uemscommlib";
import {ConfigurationSchema} from "./ConfigurationTypes";
import {launchCheck, RabbitNetworkHandler, tryApplyTrait} from "@uems/micro-builder/build/src";
import {DiscoveryValidators} from "@uems/uemscommlib/build/discovery/DiscoveryValidators";
import DiscoveryMessageValidator = DiscoveryValidators.DiscoveryMessageValidator;
import DiscoveryResponseValidator = DiscoveryValidators.DiscoveryResponseValidator;

setupGlobalLogger();
const __ = _ml(__filename);

launchCheck(['successful', 'errored', 'rabbitmq', 'database'], (traits: Record<string, any>) => {
    if (has(traits, 'rabbitmq') && traits.rabbitmq !== '_undefined' && !traits.rabbitmq) return 'unhealthy';
    if (has(traits, 'database') && traits.database !== '_undefined' && !traits.database) return 'unhealthy';

    // If 75% of results fail then we return false
    if (has(traits, 'successful') && has(traits, 'errored')) {
        const errorPercentage = traits.errored / (traits.successful + traits.errored);
        if (errorPercentage > 0.05) return 'unhealthy-serving';
    }

    return 'healthy';
});

__.info('starting hephaestus...');

let messager: RabbitNetworkHandler<any, any, any, any, any, any> | undefined;
let database: EquipmentDatabase | undefined;
let configuration: z.infer<typeof ConfigurationSchema> | undefined;

fs.readFile(process.env.UEMS_HEPHAESTUS_CONFIG_LOCATION ?? path.join(__dirname, '..', '..', 'config', 'configuration.json'), {encoding: 'utf8'})
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

            tryApplyTrait('database', false);
            reject(err);
        });

        database.once('ready', () => {
            __.info('database connection enabled');
            // Make sure we dont later try and reject a resolved promise from an unrelated error
            unbind();

            if (database) {
                resolve(database);
            } else {
                tryApplyTrait('database', false);
                reject(new Error('database is invalid'));
            }
        });
    })))
    .then(() => (new Promise<void>((resolve, reject) => {
        if (!configuration) {
            __.error('reached an uninitialised configuration, this should not be possible');
            reject(new Error('uninitialised configuration'));
            return;
        }

        __.info('setting up the message broker');

        messager = new RabbitNetworkHandler<EM.EquipmentMessage | DiscoveryMessage.DiscoveryDeleteMessage,
            EM.CreateEquipmentMessage,
            EM.DeleteEquipmentMessage,
            EM.ReadEquipmentMessage | DiscoveryMessage.DiscoveryDeleteMessage,
            EM.UpdateEquipmentMessage,
            // @ts-ignore
            ER.EquipmentReadResponseMessage | ER.EquipmentResponseMessage | DiscoveryResponse.DiscoveryDeleteResponse>
        (
            configuration.message,
            async (data) => {
                try {
                    if (await new EquipmentMessageValidator().validate(data)) {
                        return true
                    }
                } catch (e) {
                }

                return await new DiscoveryMessageValidator().validate(data);
            },
            async (data) => {
                try {
                    if (await new EquipmentResponseValidator().validate(data)) {
                        return true
                    }
                } catch (e) {
                }

                return await new DiscoveryResponseValidator().validate(data);
            },
        );

        const unbind = messager.once('error', (err) => {
            __.error('failed to setup the message broker', {
                error: err,
            });
            tryApplyTrait('rabbitmq', false);

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
        tryApplyTrait('database', false);
        tryApplyTrait('rabbitmq', false);
    });
