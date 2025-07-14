import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { NestedStack, NestedStackProps } from 'aws-cdk-lib';

export interface MLOpsStepFunctionsProps extends NestedStackProps {
  exportLambda: lambda.IFunction;
  modelTrainingLambda?: lambda.IFunction;
  importLambda?: lambda.IFunction;
}

export class MLOpsStepFunctions extends NestedStack {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: MLOpsStepFunctionsProps) {
    super(scope, id, props);

    // Tarefa que invoca a Lambda de exportação das tabelas
    const invokeExportLambda = new tasks.LambdaInvoke(this, 'InvokeExportTables', {
      lambdaFunction: props.exportLambda,
      outputPath: '$.Payload',
    });

    let chain = sfn.Chain.start(invokeExportLambda);

    // Se existir a lambda de treinamento, insere o estado de espera de 7 minutos
    if (props.modelTrainingLambda) {
      const wait7Minutes = new sfn.Wait(this, 'Wait7Minutes', {
        time: sfn.WaitTime.duration(cdk.Duration.minutes(7)),
      });

      const invokeModelTrainingLambda = new tasks.LambdaInvoke(this, 'InvokeModelTraining', {
        lambdaFunction: props.modelTrainingLambda,
        outputPath: '$.Payload',
      });

      chain = chain.next(wait7Minutes).next(invokeModelTrainingLambda);

      // Se existir a lambda de importação, encadeia a chamada
      if (props.importLambda) {
        const invokeImportLambda = new tasks.LambdaInvoke(this, 'InvokeImportTables', {
          lambdaFunction: props.importLambda,
          outputPath: '$.Payload',
        });
        chain = chain.next(invokeImportLambda);
      }
    }

    // Define a máquina de estados com o fluxo criado
    this.stateMachine = new sfn.StateMachine(this, 'MLOpsStateMachine', {
      definition: chain,
      timeout: cdk.Duration.minutes(60),
    });
  }
}