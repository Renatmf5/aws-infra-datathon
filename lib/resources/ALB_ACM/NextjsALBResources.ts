import { Construct } from 'constructs';
import { Vpc, Instance, SecurityGroup, Peer, Port } from 'aws-cdk-lib/aws-ec2';
import { ApplicationLoadBalancer, ApplicationProtocol, ApplicationTargetGroup, ListenerAction, TargetType } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { InstanceTarget } from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';

interface ALBProps {
  vpc: Vpc;
  instance: Instance;
  certificate: Certificate;
}

export class NextjsALBResources extends Construct {
  public readonly alb: ApplicationLoadBalancer;  // Expondo o ALB publicamente

  constructor(scope: Construct, id: string, props: ALBProps) {
    super(scope, id);

    const albSecurityGroup = new SecurityGroup(this, 'nextjs-ALBSecurityGroup', {
      vpc: props.vpc,
      allowAllOutbound: true,
    });

    albSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80), 'Allow HTTP traffic');
    albSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443), 'Allow HTTPS traffic');

    this.alb = new ApplicationLoadBalancer(this, 'NextjsALB', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
    });

    // Bean stalk Target Group
    const NextjsALBTargetGroup = new ApplicationTargetGroup(this, 'NextjsALBTargetGroup', {
      vpc: props.vpc,
      protocol: ApplicationProtocol.HTTP,
      port: 80,
      targetType: TargetType.INSTANCE,
    });

    NextjsALBTargetGroup.addTarget(new InstanceTarget(props.instance));

    const NextjsALBListener = this.alb.addListener('NextjsALBListener', {
      port: 443,
      certificates: [props.certificate],
      defaultAction: ListenerAction.forward([NextjsALBTargetGroup]),
    });

    // Redirect HTTP to HTTPS
    this.alb.addListener('HTTPListener', {
      port: 80,
      protocol: ApplicationProtocol.HTTP,
      defaultAction: ListenerAction.redirect({
        protocol: ApplicationProtocol.HTTPS,
        port: '443',
        permanent: true,
      }),
    });
  }
}