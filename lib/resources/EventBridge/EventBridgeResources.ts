import { Construct } from 'constructs';
import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { aws_events as events, aws_events_targets as targets, aws_stepfunctions as sfn } from 'aws-cdk-lib';


interface EventBridgeResourcesProps extends NestedStackProps {
  stepFunctions: sfn.IStateMachine;
}

export class EventBridgeResources extends NestedStack {
  constructor(scope: Construct, id: string, props: EventBridgeResourcesProps) {
    super(scope, id, props);

    // Criar uma regra do EventBridge para acionar o Step Function
    const rule = new events.Rule(this, 'StepFunctionTriggerRule', {
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '0', // 00:00 UTC equivale a 21:00 BRT (-3h)
        weekDay: 'MON-SUN',
      }),
    });
    // Adicionar o Step Function como alvo da regra
    rule.addTarget(new targets.SfnStateMachine(props.stepFunctions));
  }
}