import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs'; // Importa o módulo aws-ecs

interface MlLabBatchStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  repository: ecr.IRepository;
}

export class MlLabBatchStack extends cdk.Stack {
  public readonly jobQueue: batch.JobQueue;
  public readonly jobDefinition: batch.EcsJobDefinition;

  constructor(scope: Construct, id: string, props: MlLabBatchStackProps) {
    super(scope, id, props);

    const { vpc, repository } = props;

    const jobRole = new iam.Role(this, 'BatchJobRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    jobRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'));
    jobRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'));

    // Compute Environment com SPOT
    const computeEnv = new batch.ManagedEc2EcsComputeEnvironment(
      this,
      'ComputeEnv',
      {
        vpc,
        allocationStrategy: batch.AllocationStrategy.SPOT_CAPACITY_OPTIMIZED,
        spot: true,
        minvCpus: 0,
        maxvCpus: 32,
        instanceTypes: [
          new ec2.InstanceType('c6i.xlarge'),
        ],
      }
    );

    this.jobQueue = new batch.JobQueue(this, 'JobQueue', {
      computeEnvironments: [{
        computeEnvironment: computeEnv,
        order: 1,
      }],
    });

    const containerDefinition = new batch.EcsEc2ContainerDefinition(this, 'ContainerDefinition', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
      cpu: 4096, // 4 vCPUs
      memory: cdk.Size.gibibytes(8),
      jobRole,
    });

    this.jobDefinition = new batch.EcsJobDefinition(this, 'JobDefinition', {
      container: containerDefinition,
    });

    new cdk.CfnOutput(this, 'JobQueueName', {
      value: this.jobQueue.jobQueueName,
    });

    new cdk.CfnOutput(this, 'JobDefinitionName', {
      value: this.jobDefinition.jobDefinitionName,
    });
  }
}