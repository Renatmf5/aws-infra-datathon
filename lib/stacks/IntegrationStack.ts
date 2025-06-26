import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';

interface IntegrationStackProps extends StackProps {
  pipelineName: string;
  lambdaFunctionArn: string;
}

export class PipelineLambdaIntegrationStack extends Stack {
  constructor(scope: Construct, id: string, props: IntegrationStackProps) {
    super(scope, id, props);

    // 🔗 Importa a Lambda existente
    const lambdaFn = lambda.Function.fromFunctionArn(
      this,
      'ImportedLambda',
      props.lambdaFunctionArn
    );

    // ⚠️ Não é possível adicionar uma stage a um pipeline importado via fromPipelineArn.
    // Você deve definir o pipeline nesta stack para adicionar stages, ou manipular via AWS SDK/CloudFormation fora do CDK.

    // 🛡️ Permissão para o pipeline invocar a Lambda
    lambdaFn.grantInvoke(new iam.ServicePrincipal('codepipeline.amazonaws.com'));

    // 💡 Opcional: Log de aviso
    console.warn('Não é possível adicionar uma stage a um pipeline importado via fromPipelineArn. Defina o pipeline nesta stack para adicionar stages.');
  }
}
