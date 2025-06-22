import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as  s3 from 'aws-cdk-lib/aws-s3';

export interface MlLabEcsStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  bucketArn: s3.IBucket;
}

export class MlLabEcsStack extends cdk.Stack {
  public readonly clusterName: string;
  public readonly containerName: string;
  public readonly serviceName: string;
  public readonly ecsService: ecs.FargateService;
  public readonly repository: ecr.IRepository;

  constructor(scope: Construct, id: string, props: MlLabEcsStackProps) {
    super(scope, id, props);
    const { vpc, bucketArn } = props;

    // Cria o repositório ECR para as imagens (para builds posteriores, por exemplo)
    const repository = new ecr.Repository(this, 'MlLabRepository', {
      repositoryName: 'ml-lab',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.repository = repository;

    // Criação do cluster ECS na VPC
    const cluster = new ecs.Cluster(this, 'EcsCluster', { vpc });
    this.clusterName = cluster.clusterName;

    // Obter a imagem dummy do repositório privado que você pushou
    const dummyRepository = ecr.Repository.fromRepositoryArn(
      this, 'DummyRepo',
      'arn:aws:ecr:us-east-1:324037302745:repository/dummy_image'
    );

    // Criar uma task e um container que expande memoria conforme o necessário
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      cpu: 4096,              // 4 vCPUs
      memoryLimitMiB: 16384,  // 16 GB RAM
    });


    const container = taskDefinition.addContainer('MlLabContainer', {
      image: ecs.ContainerImage.fromEcrRepository(dummyRepository, 'latest'),
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'ml-lab',
      }),
      // Opcional: você pode definir uma memória reservada específica para o container.
      memoryReservationMiB: 16384  // Reserve 16384 MiB para o container
    });


    this.containerName = container.containerName;

    // Cria o serviço ECS em subnets públicas (com IP público para acesso à Internet)
    const ecsService = new ecs.FargateService(this, 'EcsService', {
      cluster,
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      enableExecuteCommand: true,
    });
    this.serviceName = ecsService.serviceName;
    this.ecsService = ecsService;

    // Concede permissões para puxar a imagem do repositório ml-lab
    repository.grantPull(ecsService.taskDefinition.taskRole);

    // Adiciona permissões necessárias à task execution role para acesso ao ECR
    ecsService.taskDefinition.addToExecutionRolePolicy(new iam.PolicyStatement({
      actions: [
        'ecr:GetAuthorizationToken',
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
        'logs:CreateLogGroup'
      ],
      resources: [repository.repositoryArn],
    }));

    // Permissão de acesso ao S3 para o container (TASK ROLE)
    taskDefinition.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: [
        's3:ListBucket',
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
      ],
      resources: [
        bucketArn.bucketArn,
        bucketArn.arnForObjects('*'),
      ],
    }))

  }
}