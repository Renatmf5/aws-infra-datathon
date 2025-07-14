import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { LambdaExportTablesStack } from '../resources/Lambda/LambdaExportTables';
import { LambdaImportTablesStack } from '../resources/Lambda/LambdaImportTables';
import { MLOpsStepFunctions } from '../resources/StepFunctions/MLOpsStepFunctions';
import { EventBridgeResources } from '../resources/EventBridge/EventBridgeResources';

interface MLOpsStackProps extends cdk.StackProps {
  modelTrainingLambda?: lambda.IFunction; // Opcional, se existir a Lambda de treinamento do modelo
}

export class MLOpsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: MLOpsStackProps) {
    super(scope, id, props);

    const { modelTrainingLambda } = props || {};

    // Cria o NestedStack para a função Lambda de exportação
    const lambdaStack = new LambdaExportTablesStack(this, 'LambdaExportTablesStack');

    // Cria o NestedStack para a função Lambda de importação
    const importLambdaStack = new LambdaImportTablesStack(this, 'LambdaImportTablesStack');

    // Cria o NestedStack para a máquina de estados do Step Functions, utilizando a Lambda criada acima
    const stepFunctionsStack = new MLOpsStepFunctions(this, 'MLOpsStepFunctions', {
      exportLambda: lambdaStack.exportTablesLambda,
      modelTrainingLambda: modelTrainingLambda, // Se existir, passa a Lambda de treinamento do modelo
      importLambda: importLambdaStack.importTablesLambda, // Passa a Lambda de importação
    });

    // Cria o NestedStack para o EventBridge que aciona o Step Functions, passando a referência da máquina de estados
    new EventBridgeResources(this, 'EventBridgeResources', {
      stepFunctions: stepFunctionsStack.stateMachine,
    });

    // Aqui você pode adicionar outras permissões e configurações necessárias, como políticas IAM, se necessário.
  }
}