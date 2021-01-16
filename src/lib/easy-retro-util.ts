import config from 'config';
import EventEmitter from 'events';
import {
    cloneDeep,
    get,
    find,
    forEach,
    max,
    sortBy,
    sum,
    values,
} from 'lodash';
import {EOL} from 'os';
import * as I from './models';
import puppeteerManager from './puppeteer-manager';
import store from './store';
import {Message} from './models';

const isValidUrl = (url: string): boolean => {
    return new RegExp(/^(https:\/\/easyretro\.io\/publicboard\/)(.*\/)([0-9A-Fa-f]{8}[-][0-9A-Fa-f]{4}[-][0-9A-Fa-f]{4}[-][0-9A-Fa-f]{4}[-][0-9A-Fa-f]{12})$/, 'gm').test(url);
};

function organizeData (elements: object[]): I.BoardInformation {
    const data = new Map();

    // Separate the elements out and begin reducing the data
    while (elements.length > 0) {
        const element = elements.pop();
        const describer: string = get(element, config.get('easy-retro.paths.describer'), '');
        const value: object = get(element, config.get('easy-retro.paths.value'));

        if (describer.substring(0, 12) === 'publicboards') {
            data.set('boardInformation', value);
        }

        if (describer.substring(0, 20) === 'columns/publicboards') {
            data.set('columns', value);
        }

        if (describer.substring(0, 8) === 'messages') {
            data.set('messages', value);
        }
    }

    // Object formatting, creating, parsing
    const boardName: string = data.get('boardInformation')?.boardName;
    const unformattedBaseColumnData = data.get('boardInformation')?.columns;
    const unformattedColumnsToMessagesIds = data.get('columns');
    const unformattedMessages = data.get('messages');

    const boardInformation = new I.BoardInformation(boardName);

    forEach(unformattedBaseColumnData, (value, key: string) => {
        const id: number = parseInt(key);
        const text: string = value?.value;
        const messageIdsFromData = find(unformattedColumnsToMessagesIds, (_, ikey) => parseInt(ikey) === id);
        const messageIds = values<string>(messageIdsFromData?.messagesIds);
        const column = new I.BoardColumn(id, text, messageIds);
        boardInformation.columns.push(column);
    });

    forEach(unformattedMessages, (value, key: string) => {
        const votes: number = sum(values<number>(value?.votes));
        const text: string = value?.text;
        const message = new I.Message(key, text, votes);
        boardInformation.messages.push(message);
    });

    return boardInformation;
}

async function getBoardInfo(url: string): Promise<I.BoardInformation> {
    // Establish that the url provided is valid and move on if it is good to go
    if (!isValidUrl(url)) {
        throw new Error('Invalid url provided, format must be https://easyretro.io/*/guid');
    }

    const emitter = new EventEmitter();
    const receivedKeyElements = [];
    const keyElementRegExp = new RegExp(/messages|publicboards/);
    const page = await puppeteerManager.pagePool.acquire();

    //@ts-ignore
    page._client.on('Network.webSocketFrameReceived', ({response}) => {
        // Websocket Frames that are received from easyretro have 3 key elements we need to keep for later use
        // key elements are frames that contain publicboards and messages
        // response.payloadData: string
        const hasKeyElement = keyElementRegExp.test(response.payloadData);
        if (hasKeyElement) receivedKeyElements.push(JSON.parse(response.payloadData));
        // Once we have received 3 key elements, we no longer need puppeteer open.
        // At this point we have received,
        // general board information such as title and number of columns (typically first key element)
        // column to message keys information (typically second key element)
        // message keys to message information (typically third key element)
        if (receivedKeyElements.length === 3) {
            emitter.emit('DataReceived');
        }
    });

    // Create a unfulfilled promise that can then be resolved based on an event
    const waitForData = new Promise<void>((resolve, reject) => {
        // Give 10 seconds to acquire data from the url, else it will error out
        const timeout = setTimeout(() => reject('Timed out getting easy retro data'), 10000);
        emitter.on('DataReceived', () => {
            clearTimeout(timeout);
            resolve();
        });
    });

    await page.goto(url);
    await waitForData;
    // Destroy the page resource as we no longer need it
    await puppeteerManager.pagePool.destroy(page);

    const data: I.BoardInformation = organizeData(receivedKeyElements);

    store.save(data);
    return data;
}

// Find columns and find associated messages to those columns, and tie them together
function attachColumnToMessages(): {column: I.BoardColumn, messages: I.Message[]}[] {
    const columns = sortBy(store.boardInformation.columns, 'id');
    return columns.map(column => {
        const messages = store.boardInformation.messages.reduce<Message[]>((acc, message) => {
            const isMessagePartOfColumn = column.messageIds.includes(message.messageId);
            if (isMessagePartOfColumn) acc.push(message);
            return acc;
        }, []);
        return {column, messages};
    });
}

function createObjectCSV(): string[] {
    const csvObject: string[] = [];
    // We do not want to mutate the data in the store,
    // so lodash cloneDeep takes care of any deep object and symbol references and makes true clone of our columns/messages
    // that we can mutate however we want without affecting the original from store.
    const columnsMessages = cloneDeep(attachColumnToMessages());

    const maxRowLength = max(columnsMessages.map(m => m.messages.length));

    const rows: Message[][] = [];

    // Creates the following structure for rows & columns
    // [
    //     row1 & column1, row1 & column2, row1 & column3, ...
    //     row2 & column1, row2 & column2, row2 & column3, ...
    //     row3 & column1, row3 & column2, row3 & column3, ...
    //     ...
    // ]
    for (let i = 0; i < maxRowLength; i++) {
        const messages: Message[] = [];
        for (let j = 0; j < columnsMessages.length; j++) {
            messages[columnsMessages[j].column.id] = columnsMessages[j].messages.pop();
        }
        rows.push(messages);
    }

    // Format each iteratee as a string
    // No message/text should be written for messages that have less than 1 vote
    for (const row of rows) {
        const csvRow = row
            .map(r => {
                if (r?.votes < 1) {
                    return '';
                }
                return r?.text ?? '';
            })
            .join(',') + EOL;
        csvObject.push(csvRow);
    }

    const header: string = columnsMessages.map(cm => cm.column.value).join(',') + EOL;
    return [header].concat(csvObject);
}

function createLegacyFormat(): string[] {
    const legacyObject: string[] = [];
    const columnsMessages = attachColumnToMessages();

    // Push board title in first
    legacyObject.push(store.boardInformation.boardName + EOL + EOL);

    for (const cm of columnsMessages) {
        // Set column title
        legacyObject.push(cm.column.value + EOL);
        // Attach messages associated to the column
        legacyObject.push(
            ...cm.messages.map(message => `- ${message.text} (${message.votes})` + EOL),
            EOL,
        );

    }

    return legacyObject;
}

export {
    getBoardInfo,
    createObjectCSV,
    createLegacyFormat,
};
