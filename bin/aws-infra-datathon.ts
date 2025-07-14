#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { S3DataLakeResources } from '../lib/resources/S3/DataLakeResources';
import { VPCResourcesStack } from '../lib/resources/Vpc/VpcResources';
import { MlLabPipelineStack } from '../lib/resources/Pipelines/MlLabPipelineStack';
import { MlLabBatchStack } from '../lib/resources/Batch/BatchTrainingStack';
import { LambdaModelTrainingStack } from '../lib/resources/Lambda/LambdaModelTrainingStack';
import { ParameterStoreStack } from '../lib/resources/Utils/ParameterStore';
import { FastApiStack } from '../lib/stacks/FastApiStack';
import { Route53Stack } from '../lib/stacks/Route53AppStack';
import { MLOpsStack } from '../lib/stacks/MLOpsStack';
import { NextJsAppStack } from '../lib/stacks/NextjsAppStack';
import { CICDNextJsStack } from '../lib/resources/Pipelines/CodePipelineNextjsApp';


const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};
const stackPropsWEBAPP = {
  logLevel: process.env.LOG_LEVEL || 'INFO',
  sshPubKey: process.env.SSH_PUB_KEY || ' ',
  cpuType: process.env.CPU_TYPE || 'X86_64',
  instanceSize: process.env.INSTANCE_SIZE_WEBAPP || 'MICRO',
};

const app = new cdk.App();
// S3 Bucket Stack
const s3DataLakeResources = new S3DataLakeResources(app, 'S3DataLakeResources', {
  env: devEnv,
});

const parameterStoreStack = new ParameterStoreStack(app, 'ParameterStoreStack', {
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
  repositoryName: mlLabPipelineStack.repository.repositoryName,
});


const fastApiStack = new FastApiStack(app, 'FastApiStack', {
  vpc: vpcResourcesStack.vpc,
  bucket: s3DataLakeResources.bucket,
  env: devEnv,
});

const nextJsAppStack = new NextJsAppStack(app, 'NextJsAppStack', {
  ...stackPropsWEBAPP,
  env: devEnv,
  vpc: vpcResourcesStack.vpc,
  sshSecurityGroup: vpcResourcesStack.sshSecurityGroup,
  acm: fastApiStack.acmResources, // Passando o ACM do FastAPI para o Next.js
});

// Criação do pipeline para o Next.js
const nextJsPipeline = new CICDNextJsStack(app, 'NextJsPipeline', {
  env: devEnv,
});


const route53AppStack = new Route53Stack(app, 'Route53AppStack', {
  fastApiLoadBalancer: fastApiStack.fastApiAlbResources.alb,
  NextJsLoadBalancer: nextJsAppStack.albWeb.alb, // Passando o ALB do Next.js
  env: devEnv,
});

const mlOpsStack = new MLOpsStack(app, 'MLOpsStack', {
  env: devEnv,
  modelTrainingLambda: lambdaModelTrainingStack.startTrainModelLambda, // Passando a Lambda de treinamento do modelo
});

// Configurando dependências entre os stacks para forçar a ordem de criação:
// VPC deve ser criada antes do pipeline; o ECS depende do pipeline (para o repositório) e da VPC;
// e a Lambda depende do ECS.
vpcResourcesStack.addDependency(s3DataLakeResources);
mlLabPipelineStack.addDependency(vpcResourcesStack);
mlLabBatchStack.addDependency(mlLabPipelineStack);
lambdaModelTrainingStack.addDependency(mlLabBatchStack);
fastApiStack.addDependency(vpcResourcesStack);
nextJsAppStack.addDependency(fastApiStack);
nextJsPipeline.addDependency(nextJsAppStack);
route53AppStack.addDependency(nextJsAppStack);
mlOpsStack.addDependency(route53AppStack);


app.synth();