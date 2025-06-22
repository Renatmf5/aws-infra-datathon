#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { S3DataLakeResources } from '../lib/resources/S3/DataLakeResources';
import { VPCResourcesStack } from '../lib/resources/Vpc/VpcResources';
import { MlLabPipelineStack } from '../lib/resources/Pipelines/MlLabPipelineStack';
import { MlLabBatchStack } from '../lib/resources/Batch/BatchTrainingStack';
import { LambdaModelTrainingStack } from '../lib/resources/Lambda/LambdaModelTrainingStack';


const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

const app = new cdk.App();
// S3 Bucket Stack
const s3DataLakeResources = new S3DataLakeResources(app, 'S3DataLakeResources', {
  env: devEnv,
});

// VPC Stack
const vpcResourcesStack = new VPCResourcesStack(app, 'VpcResourcesStack', {
  env: devEnv,
});

// Stack Pipeline - passando o serviço ECS para que possa atualizar a task
const mlLabPipelineStack = new MlLabPipelineStack(app, 'MlLabPipelineStack', {
  env: devEnv,
});


// Stack Batch - passando o bucket S3 e o nome do job
const mlLabBatchStack = new MlLabBatchStack(app, 'MlLabBatchStack', {
  env: devEnv,
  vpc: vpcResourcesStack.vpc,
  repository: mlLabPipelineStack.repository,
});



// Stack da Lambda para acionar o task ECS
const lambdaModelTrainingStack = new LambdaModelTrainingStack(app, 'LambdaModelTrainingStack', {
  env: devEnv,
  bucketName: s3DataLakeResources.bucket.bucketName,
  jobQueueName: mlLabBatchStack.jobQueue.jobQueueName,
  jobDefinitionName: mlLabBatchStack.jobDefinition.jobDefinitionName,
});

/*
// Stack ECS - certificando-se que o repositório será referenciado posteriormente
const mlLabEcsStack = new MlLabEcsStack(app, 'MlLabEcsStack', {
  env: devEnv,
  vpc: vpcResourcesStack.vpc,
  bucketArn: s3DataLakeResources.bucketArn,
});

*/
// Configurando dependências entre os stacks para forçar a ordem de criação:
// VPC deve ser criada antes do pipeline; o ECS depende do pipeline (para o repositório) e da VPC;
// e a Lambda depende do ECS.
vpcResourcesStack.addDependency(s3DataLakeResources);
mlLabPipelineStack.addDependency(vpcResourcesStack);
mlLabBatchStack.addDependency(mlLabPipelineStack);
lambdaModelTrainingStack.addDependency(mlLabBatchStack);


app.synth();