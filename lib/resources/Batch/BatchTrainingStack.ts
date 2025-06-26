import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs'; // Importa o módulo aws-ecs
import * as logs from 'aws-cdk-lib/aws-logs';

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
    jobRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess'));


    /*
    // Compute Environment com SPOT
    const computeEnv = new batch.ManagedEc2EcsComputeEnvironment(
      this,
      'ComputeEnv',
      {
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
        allocationStrategy: batch.AllocationStrategy.SPOT_CAPACITY_OPTIMIZED,
        spot: true,
        minvCpus: 0,
        maxvCpus: 32,
        instanceTypes: [
          new ec2.InstanceType('c6i.xlarge'),
        ],
      }
    );
    
    // 1. CRIE UM LAUNCH TEMPLATE EXPLÍCITO
    const launchTemplate = new ec2.LaunchTemplate(this, 'MlLabLaunchTemplate', {
      launchTemplateName: 'ml-lab-c6i-2xlarge-template',
      instanceType: new ec2.InstanceType('c6i.2xlarge'),
      // O Batch irá usar a AMI otimizada para ECS por padrão, não precisa especificar aqui
    });
    */

    // Compute Environment com ON_DEMAND
    const computeEnv = new batch.ManagedEc2EcsComputeEnvironment(
      this,
      'FinalManagedComputeEnv', // Usei um novo ID para garantir a recriação
      {
        vpc,
        // Usando a VPC mult-AZ
        vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },

        // Lição 2: Usar a estratégia direta
        allocationStrategy: batch.AllocationStrategy.BEST_FIT_PROGRESSIVE,

        // Apenas UMA forma de especificar a instância é usada
        instanceTypes: [
          new ec2.InstanceType('c6i.2xlarge'),
        ],
        useOptimalInstanceClasses: false, // Desativando para usar tipos de instância específicos

        spot: false,
        minvCpus: 0, // Para máxima economia de custos
        maxvCpus: 8,

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
      cpu: 8, // 4 vCPUs
      memory: cdk.Size.gibibytes(14),
      jobRole,
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'ml-lab-job',
        logGroup: new logs.LogGroup(this, 'BatchJobLogGroup', {
          logGroupName: '/aws/batch/ml-lab',
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),

      }),

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