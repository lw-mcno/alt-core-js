import {Action} from "./Action";
import {ActionType} from "./ActionType";
import {getLogger} from "../logging";
import {Scenario} from "./Scenario";
import {stringify} from "querystring";
import {injectEvalAndVarsToMap, injectEvalAndVarsToString} from "../variableInjection";
import {ActionCallback} from "./ActionCallback";
import {addWsMessage} from "../diagramDrawing";

const WebSocket = require('ws');
const MAX_RECONNECTIONS = 3;

class WebSocketAction implements Action {

    private wsInstance: any;
    private reconnected = 0;

    serviceName: string;
    name: string;
    type = ActionType.WEBSOCKET;
    url: string;
    headers: any;
    data: any;
    expectedNumberOfMessages: number;
    messageFilter: string[];

    private receivedMessages: Set<string>;

    constructor(name: string, wsDefinition: any, serviceName: string, url = wsDefinition.url, headers = wsDefinition.headers, data = wsDefinition.data,
                expectedNumberOfMessages = wsDefinition.expectedNumberOfMessages, messageFilter = wsDefinition.messageFilter) {
        this.name = name;
        this.serviceName = serviceName;
        this.url = url;
        this.headers = headers;
        this.data = data;
        this.expectedNumberOfMessages = expectedNumberOfMessages;
        this.messageFilter = messageFilter;

        this.receivedMessages = new Set<string>();
    }

    static fromTemplate(wsDefinition: any, template: WebSocketAction): WebSocketAction {
        return new WebSocketAction(
            template.name,
            wsDefinition,
            template.serviceName,
            template.url,
            template.headers ? Object.assign(Object.assign({}, template.headers), wsDefinition.headers) : wsDefinition.restHead,
            this.loadData(template, wsDefinition),
            wsDefinition.expectedNumberOfMessages || template.expectedNumberOfMessages
        );
    }

    private static loadData(template: WebSocketAction, actionDef: any) {
        if (template.data) {
            if (Array.isArray(template.data))
                return template.data.concat(actionDef.data || []);
            else
                return Object.assign(Object.assign({}, template.data), actionDef.data);
        } else {
            return actionDef.data;
        }
    }

    invoke(scenario: Scenario): ActionCallback {

        const promise = new Promise((resolve => {
            this.invokeAsync(scenario);
            resolve();
        }));

        return {
            promise,
            cancel: () => this.wsInstance.close()
        };
    }

    invokeAsync(scenario: Scenario): void {

        let ctx = {scenario: scenario.name, action: this.name};
        let resolvedUrl = injectEvalAndVarsToString(this.url, scenario.cache, ctx);
        let queryParams = injectEvalAndVarsToMap(this.headers, scenario.cache, ctx);
        const registeredMessageFilters = this.messageFilter;

        const logDebug = function (debugMessage: string) {
            getLogger(scenario.name).debug(debugMessage, ctx);
        };

        const logError = function (errorMessage: string) {
            getLogger(scenario.name).error(errorMessage, ctx);
        };

        const isMessageRelevant = function (msg: String) {
            if (registeredMessageFilters) {
                return registeredMessageFilters.some(filter => {
                    filter = injectEvalAndVarsToString(filter, scenario.cache, ctx).toString();
                    const filterResult: boolean = eval(filter);
                    logDebug(`Filter (${filter}): ${filterResult}`);
                    return filterResult;
                });
            }
            return true;
        };


        this.wsInstance = new WebSocket(`${resolvedUrl}?${stringify(queryParams)}`);

        this.wsInstance.on('open', () => {
            logDebug(`WebSocket to ${resolvedUrl} successfully opened!`);

            if (this.data && this.reconnected == 0) {
                let payload = JSON.stringify(this.data);
                this.wsInstance.send(payload);
                logDebug(`WS message sent: ${payload}`);
            }
        });

        this.wsInstance.on('message', (data: any) => {
            let parsedMessage = JSON.parse(data.toString());
            if (isMessageRelevant(parsedMessage)) {
                this.receivedMessages.add(data);
                logDebug(`Relevant WS message received (${this.receivedMessages.size}/${this.expectedNumberOfMessages}): ${data}`);
                addWsMessage(scenario.name, this.serviceName, parsedMessage);
            }
        });

        this.wsInstance.on('close', (code) => {
            if (code === 1006 && this.reconnected <= MAX_RECONNECTIONS) {
                logDebug('reconnecting...');
                this.reconnected++;
                this.invokeAsync(scenario);

            } else {
                logDebug('Successfully closed WS connection: ' + code);
                if (this.receivedMessages.size !== this.expectedNumberOfMessages) {
                    logError(`Unexpected number of messages retrieved: ${this.receivedMessages.size} (expected: ${this.expectedNumberOfMessages})`)
                }
            }
        });

        this.wsInstance.on('error', (err) => {
            logError('' + err);
        });

    }
}

export { WebSocketAction }