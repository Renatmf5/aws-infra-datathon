import {
  Stack, StackProps, Duration,
  aws_lambda as lambda,
  aws_iam as iam,
  aws_events as events,
  aws_events_targets as targets,
  RemovalPolicy
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as s3 from 'aws-cdk-lib/aws-s3';

interface LambdaStackProps extends StackProps {
  bucketName: string;
  jobQueueName: string;
  jobDefinitionName: string;
  repositoryName?: string;
}

export class LambdaModelTrainingStack extends Stack {
  public readonly startTrainModelLambda: lambda.IFunction;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const { bucketName, jobQueueName, jobDefinitionName, repositoryName } = props;


    // Criação do bucket para logs do CloudTrail
    const trailBucket = new s3.Bucket(this, 'TrailBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Criação do CloudTrail que captura todos os events management (read/write) e eventos globais
    new cloudtrail.Trail(this, 'MyTrail', {
      bucket: trailBucket,
      isMultiRegionTrail: true,
      managementEvents: cloudtrail.ReadWriteType.ALL,
      includeGlobalServiceEvents: true,
    });

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

    // Conceder permissões à Lambda para submeter jobs no Batch
    lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['batch:SubmitJob', 'batch:DescribeJobs'],
      resources: ['*'],
    }));

    this.startTrainModelLambda = lambdaFunction;

    // EventBridge Rule - ECR image Push > Lambda Trigger
    const rule = new events.Rule(this, 'ECRImagePushRule', {
      eventPattern: {
        source: ['aws.ecr'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventName: ['PutImage'],
          eventSource: ['ecr.amazonaws.com'],
          requestParameters: {
            repositoryName: [repositoryName || 'ml-lab']
            //imageTag: ['latest'] // descomente se desejar filtrar por tag
          }
        }
      },
    });

    rule.addTarget(new targets.LambdaFunction(lambdaFunction));

    // Permissão para o EventBridge chamar a Lambda
    lambdaFunction.addPermission('EventBridgeInvokePermission', {
      action: 'lambda:InvokeFunction',
      principal: new iam.ServicePrincipal('events.amazonaws.com'),
      sourceArn: rule.ruleArn,
    });
  }
}