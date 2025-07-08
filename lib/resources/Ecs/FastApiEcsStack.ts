import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';

export interface FastApiEcsStackProps extends NestedStackProps {
  vpc: ec2.IVpc;
  bucketArn: s3.IBucket;
  env?: cdk.Environment;  // Propriedade opcional adicionada
}

export class FastApiEcsStack extends NestedStack {
  public readonly clusterName: string;
  public readonly containerName: string;
  public readonly serviceName: string;
  public readonly ecsService: ecs.FargateService;
  public readonly repository: ecr.IRepository;

  constructor(scope: Construct, id: string, props: FastApiEcsStackProps) {
    super(scope, id, props);
    const { vpc, bucketArn } = props;

    // Cria o repositório ECR para imagens (para builds posteriores, por exemplo)
    const repository = new ecr.Repository(this, 'FastApiRepository', {
      repositoryName: 'fast-api',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.repository = repository;

    // Cria o cluster ECS na VPC
    const cluster = new ecs.Cluster(this, 'FastApiCluster', { vpc });
    this.clusterName = cluster.clusterName;

    // Cria a task definition para Fargate com CPU e memória configurados
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      cpu: 2048,             // 2048 CPU units = 2 vCPU
      memoryLimitMiB: 4096,   // 4096 MiB = 4GB de memória
    });

    // Utiliza a imagem dummy já pushada no repositório privado (dummy_image)
    const dummyRepository = ecr.Repository.fromRepositoryArn(
      this, 'DummyRepo',
      'arn:aws:ecr:us-east-1:324037302745:repository/dummy_image'
    );

    // Adiciona o container à task definition
    const container = taskDefinition.addContainer('FastApiContainer', {
      image: ecs.ContainerImage.fromEcrRepository(dummyRepository, 'latest'),
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'fast-api',
      }),
    });
    this.containerName = container.containerName;

    // Adicione o mapeamento de porta para o container (por exemplo, porta 80)
    container.addPortMappings({
      containerPort: 80,
    });

    // Cria o serviço Fargate – tasks em subnets públicas com IP público
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

    // Concede permissões para puxar a imagem do repositório fast-api 
    repository.grantPull(ecsService.taskDefinition.taskRole);

    // Adiciona permissões necessárias à task execution role para acessar o ECR e criar logs
    taskDefinition.addToExecutionRolePolicy(new iam.PolicyStatement({
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

    // Adiciona permissões para acesso ao S3
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
    }));

    // Permissão para acessar parâmetros no SSM (por exemplo, JWT_SECRET)
    taskDefinition.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParameter'],
      resources: ['arn:aws:ssm:us-east-1:324037302745:parameter/my-fastApi-app/*'],
    }));
  }
}