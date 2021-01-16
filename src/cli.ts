import config from 'config';
import fs from 'fs';
import path from 'path';
import snakeCase from 'lodash/snakeCase';
import yargs from 'yargs';
import {ArgV} from './lib/models';
import puppeteerManager from './lib/puppeteer-manager';
import store from './lib/store';
import {getBoardInfo, createLegacyFormat, createObjectCSV} from './lib/easy-retro-util';
import streamer from './lib/stream';
import logger from './lib/log';

yargs
    .command<ArgV>({
        command: 'download',
        describe: 'Downloads a easy retro public board\'s data and outputs in a desired format',
        builder: {
            url: {
                describe: 'URL for the easy retro publicboard',
                demandOption: true,
                type: 'string',
            },
            format: {
                describe: 'Format to export data as. Valid options are csv OR legacy',
                demandOption: true,
                type: 'string',
            },
            destination: {
                describe: 'Pathlike where to export the data. Defaults to ./ in the process common working dir',
                demandOption: false,
                type: 'string',
                default: './',
            },
        },
        handler: async (argv) => {

            if (!['csv', 'legacy'].includes(argv.format)) throw new Error('The format param must be defined as either csv|legacy');
            // Initialization, API configuration, Start up any resources
            logger.init(config.get('api-name'));

            const log = logger.logger;
            log.info('Initializing');


            await puppeteerManager.init();

            await getBoardInfo(argv.url);

            const isCsv: boolean = argv.format === 'csv';
            const data: string[] = isCsv
                ? createObjectCSV()
                : createLegacyFormat();

            const fileType = isCsv? 'csv' : 'txt';
            const fqPath = path.join(
                path.normalize(argv.destination),
                `/${snakeCase(store.boardInformation.boardName)}.${fileType}`
            );

            const writer = fs.createWriteStream(fqPath);

            await streamer(data, writer);

            await puppeteerManager.stop();

            log.info('Finished, file exported', {path: fqPath});

        },
    })
    .help()
    .alias('help', 'h')
    .alias('url', 'u')
    .alias('format', 'f')
    .alias('destination', 'd')
    .argv;

yargs.parse();
