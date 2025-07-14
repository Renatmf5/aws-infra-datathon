import { Construct } from 'constructs';
import {
  Duration,
  aws_lambda as lambda,
} from 'aws-cdk-lib';

import { NestedStack, NestedStackProps } from 'aws-cdk-lib';

export class LambdaImportTablesStack extends NestedStack {
  public readonly importTablesLambda: lambda.Function;

  constructor(scope: Construct, id: string, props?: NestedStackProps) {
    super(scope, id, props);

    // Criação da função Lambda para importar tabelas
    this.importTablesLambda = new lambda.Function(this, 'ImportTablesLambda', {
      functionName: 'import-tables',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lib/resources/Lambda/Code/start-import-tables'),
      timeout: Duration.minutes(15),
      environment: {
        // Adicione variáveis de ambiente necessárias aqui
      },
    });


  }
}