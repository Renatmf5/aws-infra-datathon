import {
  Stack, StackProps, Duration,
  aws_lambda as lambda, aws_iam as iam
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface LambdaStackProps extends StackProps {
  bucketName: string;
  jobQueueName: string;
  jobDefinitionName: string;
}

export class LambdaModelTrainingStack extends Stack {
  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const { bucketName, jobQueueName, jobDefinitionName } = props;

    // Criar a função Lambda
    const lambdaFunction = new lambda.Function(this, 'StartTrainModelLambda', {
      functionName: 'start-train-model',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lib/resources/Lambda/Code/start-train-model'),
      timeout: Duration.minutes(5),
      environment: {
        BUCKETNAME_S3_LAKE: bucketName,
        JOB_QUEUE: jobQueueName,
        JOB_DEFINITION: jobDefinitionName,
      },
    });

    // Conceder permissões à Lambda
    lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['batch:SubmitJob', 'batch:DescribeJobs'],
      resources: ['*'],
    }));

  }
}