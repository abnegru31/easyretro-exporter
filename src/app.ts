import config from 'config';
import cors from 'cors';
import express from 'express';
import {Server} from 'http';
import logger from './lib/log';
import puppeteerManager from './lib/puppeteer-manager';
import * as api from './api';

async function run(): Promise<Server> {
    // Initialization, API configuration, Start up any resources
    logger.init(config.get('api-name'));
    const log = logger.logger;
    const port = config.get('port');

    await puppeteerManager.init();

    const resources: (() => void)[] = [
        () => puppeteerManager.stop(),
    ];

    const app = express();
    app.use(cors());
    app.use(express.json());

    app.get('/v1/get-easy-retro-data', api.findEasyRetroBoard);
    app.get('/v1/download-easy-retro-board', api.downloadEasyRetroBoard);

    const shutdownResources = async (exitCode?: number) => {
        try {
            const timer = setTimeout(() => {
                log.error('Graceful timeout limit reached, force shutting down API');
                process.exit(exitCode ?? 1);
            }, 10000);
            await Promise.all(resources.map(resource => resource()));
            clearTimeout(timer);
            log.info('Gracefully shutdown all resources');
        } catch (err) {
            log.error('Failed to perform graceful shutdown', {err});
        } finally {
            process.exit(exitCode ?? 0);
        }
    };

    // On the following process exit codes, we should attempt to gracefully shut down any resources and let any remaining
    // clients finish their requests.
    // Current resources includes puppeteer.
    [
        'SIGHUP',
        'SIGINT',
        'SIGQUIT',
        'SIGILL',
        'SIGTRAP',
        'SIGABRT',
        'SIGBUS',
        'SIGFPE',
        'SIGUSR1',
        'SIGSEGV',
        'SIGUSR2',
        'SIGTERM',
    ].forEach(sig => process.on(sig, () => shutdownResources()));

    // @ts-ignore
    return app.listen(port, (err) => {
        if (err) {
            log.fatal('Failed to start API');
            return shutdownResources(1);
        }
        log.info('API is live', {port});
    });
}

export = run();
