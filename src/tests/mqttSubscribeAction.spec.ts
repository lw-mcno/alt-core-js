import 'mocha';
import {expect} from 'chai';
import {loadAllActions} from "../actionLoading";
import { MqttAction } from '../model/MqttAction';

describe('MQTT Subscribe action loading', () => {
    
    const TEST_ACTION_DIR = 'src/tests/resources/actions'

    it('should be able to decode proto messages', () => {
        const envConfig = {
            'my-service': 'localhost:8080'
        };
        let testAction: MqttAction = loadAllActions(TEST_ACTION_DIR, envConfig).find(a => a.name === 'mqttSubscribeProtoAction') as MqttAction;
        let result = testAction.decodeProtoPayload(Buffer.from('\n\u0007\n\u0005hello\u001a\u0005world', 'utf-8'));
        expect(result).to.eql({
            nested: {
                nestedText: 'hello'
            },
            text: 'world'
        });
    });
});