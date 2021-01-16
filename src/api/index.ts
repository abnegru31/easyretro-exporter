import {Request, Response, NextFunction} from 'express';
import {
    isEmpty,
    toString,
    snakeCase,
} from 'lodash';
import {getBoardInfo, createObjectCSV, createLegacyFormat} from '../lib/easy-retro-util';
import store from '../lib/store';
import streamer from '../lib/stream';

async function findEasyRetroBoard(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    const url: string = decodeURIComponent(toString(req.query?.url));
    try {
        const data = await getBoardInfo(url);
        // Serialize/Deserialize Object to JSON
        return res.status(200).json(JSON.parse(JSON.stringify(data)));
    } catch (err) {
        return next(err);
    }
}

async function downloadEasyRetroBoard(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    if (isEmpty(store.boardInformation)) {
        return res.status(400).json({
            error: 'You must first perform a find easy retro board action',
        });
    }

    const format: string = decodeURIComponent(toString(req.query?.format));

    if (isEmpty(format) || !['csv', 'legacy'].includes(format)) {
        return res.status(400).json({
            error: 'The format query param must be defined as either csv|legacy',
        });
    }

    try {
        const isCsv: boolean = format === 'csv';
        const data: string[] = isCsv
            ? createObjectCSV()
            : createLegacyFormat();

        const fileType = isCsv ? 'csv' : 'txt';

        res.setHeader('Content-Disposition', `attachment; filename=${snakeCase(store.boardInformation.boardName)}.${fileType}`);
        res.setHeader('Content-Type', isCsv ? 'text/csv' : 'text/plain');

        await streamer(data, res);

        return res.status(200).end();
    } catch (err) {
        next(err);
    }
}

export {
    findEasyRetroBoard,
    downloadEasyRetroBoard,
};
