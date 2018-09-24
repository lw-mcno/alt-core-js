import 'mocha';
import {expect} from 'chai';
import {loadAllActions} from "../actionLoading";
import {ActionType} from "../model/ActionType";
import {RestAction} from "../model/RestAction";
import { MqttPublishAction } from '../model/MqttPublishAction';

describe('PROTO mqtt action loading', () => {
    
    const TEST_ACTION_DIR = 'src/tests/resources/actions'

    it('should be able to encode proto def correctly', () => {
        const envConfig = {
            'my-service': 'localhost:8080'
        };
        let testAction: MqttPublishAction = loadAllActions(TEST_ACTION_DIR, envConfig).find(a => a.name === 'mqttPublishProtoAction') as MqttPublishAction;
        let result = testAction.encodeProtoPayload();
        expect(result).to.be.equal('\n\u0007\n\u0005hello\u0012\u0005world');
    });
});