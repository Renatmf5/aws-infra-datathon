import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Vpc, SecurityGroup, Peer, Port, SubnetType, InterfaceVpcEndpointAwsService, GatewayVpcEndpointAwsService } from 'aws-cdk-lib/aws-ec2';

export class VPCResourcesStack extends Stack {
  public readonly vpc: Vpc;
  public readonly sshSecurityGroup: SecurityGroup;

  constructor(scope: Construct, id: string, props?: StackProps) {

    super(scope, id, props);

    // Cria uma VPC com subnets públicas e privadas com internet gateway
    this.vpc = new Vpc(this, 'VPC_1', {
      maxAzs: 2, // Número máximo de zonas de disponibilidade
      natGateways: 0,
      createInternetGateway: true, // Cria um Internet Gateway
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: SubnetType.PUBLIC,
          mapPublicIpOnLaunch: true,
        },
        {
          cidrMask: 24,
          name: 'IsolatedSubnet',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    /*
    // Adiciona endpoint de VPC para ERC
    this.vpc.addInterfaceEndpoint('ECR', {
      service: InterfaceVpcEndpointAwsService.ECR,
      subnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
    });

    // Adiciona endpoint de VPC para ECR_DOCKER
    this.vpc.addInterfaceEndpoint('EcrDockerEndpoint', {
      service: InterfaceVpcEndpointAwsService.ECR_DOCKER,
      subnets: {
        subnetType: SubnetType.PRIVATE_ISOLATED,
      },
    });
    // Adiciona endpoint de VPC para S3
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: GatewayVpcEndpointAwsService.S3,
      subnets: [{ subnetType: SubnetType.PRIVATE_ISOLATED }],
    });
    */

    // Criação de um grupo de segurança para SSH
    this.sshSecurityGroup = new SecurityGroup(this, 'SSHSecurityGroup', {
      vpc: this.vpc,
      description: 'Security Group for SSH',
      allowAllOutbound: true,
    });

    // Permitir tráfego de entrada SSH na porta 22 TCP
    this.sshSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(22));

    // garantir que conexões https porta 443 para internet sejam permitidas
    this.sshSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443), 'Allow HTTPS traffic');
    // garantir que conexões http porta 80 para internet sejam permitidas
    this.sshSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80), 'Allow HTTP traffic');
  }
}