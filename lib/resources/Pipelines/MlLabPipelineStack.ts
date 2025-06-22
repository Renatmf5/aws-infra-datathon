import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as cpactions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';


export class MlLabPipelineStack extends cdk.Stack {
  public readonly repository: ecr.IRepository;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // Cria o repositório ECR para as imagens (para builds posteriores, por exemplo)
    const repository = new ecr.Repository(this, 'MlLabRepository', {
      repositoryName: 'ml-lab',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.repository = repository;

    // Projeto CodeBuild que constrói a imagem e faz push para o ECR
    const codeBuildProject = new codebuild.PipelineProject(this, 'MlLabBuildProject', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_4,
        privileged: true,
      },
      environmentVariables: {
        'ECR_REPO_URI': { value: repository.repositoryUri },
        'DOCKERHUB_USERNAME': { value: process.env.DOCKERHUB_USERNAME || 'seu-usuario' },
        'DOCKERHUB_PASSWORD': { value: process.env.DOCKERHUB_PASSWORD || 'sua-senha' },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: [
              'echo Installing build dependencies...',
              'yum install -y gcc gcc-c++ make'
            ]
          },
          pre_build: {
            commands: [
              'echo Logging in to Docker Hub...',
              'echo $DOCKERHUB_PASSWORD | docker login -u $DOCKERHUB_USERNAME --password-stdin',
              'echo Logging in to Amazon ECR...',
              'aws --version',
              '$(aws ecr get-login --no-include-email --region $AWS_DEFAULT_REGION)',
            ],
          },
          build: {
            commands: [
              'echo Building the Docker image...',
              'docker build -t $ECR_REPO_URI:latest .',
            ],
          },
          post_build: {
            commands: [
              'echo Pushing the Docker image...',
              'docker push $ECR_REPO_URI:latest',
              'echo Build completed on `date`',
              // Cria o arquivo imagedefinitions.json para indicar a nova imagem
              'printf \'[{"name":"MlLabContainer","imageUri":"%s:latest"}]\' $ECR_REPO_URI > imagedefinitions.json',
            ],
          },
        },
        artifacts: {
          files: [
            'imagedefinitions.json'
          ]
        }
      }),
    });

    // Concede permissões para o CodeBuild fazer push no repositório ECR
    repository.grantPullPush(codeBuildProject);

    // Artefatos de origem e build para a pipeline
    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();

    // Criação do pipeline com stages de Source e Build
    const pipeline = new codepipeline.Pipeline(this, 'MlLabPipeline', {
      pipelineName: 'MlLabPipeline',
    });

    const sourceAction = new cpactions.GitHubSourceAction({
      actionName: 'GitHub_Source',
      owner: process.env.GITHUB_USERNAME || 'seu-usuario',
      repo: process.env.REPOSITORY_ML_LAB || 'ml-lab-repo',
      branch: 'main',
      oauthToken: cdk.SecretValue.secretsManager('github/ingest-data-token', {
        jsonField: 'github_token',
      }),
      output: sourceOutput,
    });
    pipeline.addStage({
      stageName: 'Source',
      actions: [sourceAction],
    });

    const buildAction = new cpactions.CodeBuildAction({
      actionName: 'Docker_Build',
      project: codeBuildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });
    pipeline.addStage({
      stageName: 'Build',
      actions: [buildAction],
    });

    // Permissões adicionais para o CodePipeline
    pipeline.addToRolePolicy(new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: ['*'],
    }));

    new cdk.CfnOutput(this, 'RepositoryURI', {
      value: repository.repositoryUri,
      exportName: 'MlLabRepositoryURI',
    });
  }
}