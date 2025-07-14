# Projeto AWS Infra Datathon

Este projeto utiliza o AWS CDK com TypeScript para provisionar uma infraestrutura na AWS composta por diversos recursos (ECS, ALB, Lambda, VPC, S3, etc). A seguir, há um sumário e uma descrição detalhada de cada pasta, arquivo e recurso, explicando não somente o que eles são, mas como e para que estão sendo usados no contexto desta aplicação.

## Sumário

- [Visão Geral do Projeto](#visão-geral-do-projeto)
- [Estrutura de Pastas e Arquivos](#estrutura-de-pastas-e-arquivos)
  - [Arquivos Raiz](#arquivos-raiz)
  - [Pasta `bin/`](#pasta-bin)
  - [Pasta `lib/`](#pasta-lib)
    - [Stacks](#stacks)
    - [Recursos (resources/)](#recursos-resources)
  - [Pasta `src/`](#pasta-src)
  - [Pasta `test/`](#pasta-test)
- [Descrição dos Principais Recursos](#descrição-dos-principais-recursos)
  - [VPC e Subnets](#vpc-e-subnets)
  - [ECS com FastAPI](#ecs-com-fastapi)
  - [API Gateway e ALB](#api-gateway-e-alb)
  - [Lambda e Step Functions](#lambda-e-step-functions)
  - [S3 e Data Lake](#s3-e-data-lake)
- [Considerações Finais](#considerações-finais)

## Visão Geral do Projeto

Este projeto foi desenvolvido para orquestrar a infraestrutura de um ambiente de Data Science / Datathon por meio do AWS CDK. Os recursos provisionados são compostos de:
- **VPC:** Rede isolada com subnets públicas e privadas/isoladas para organizar e proteger os recursos.
- **ECS:** Cluster para executar serviços containerizados (por exemplo, um serviço FastAPI para atendimento de requisições) com foco em escalabilidade e alta disponibilidade.
- **ALB e API Gateway:** Balanceador de carga e gateway de API para rotear e expor os endpoints dos serviços de forma segura e escalável.
- **Lambda & Step Functions:** Funções serverless para orquestração de processos assíncronos (exportação, treinamento e importação de dados), criando fluxos de trabalho controlados por delay e sequenciamento.
- **S3:** Armazenamento de dados, com buckets específicos para diferentes tipos de dados, incluindo um bucket exclusivo com versionamento para a pasta “features”.

## Estrutura de Pastas e Arquivos

### Arquivos Raiz

- **cdk.context.json:** Arquivo gerado contendo contextos e configurações da aplicação durante a síntese do CloudFormation.
- **cdk.json:** Contém a configuração para execução do CDK (ex.: comando de inicialização).
- **jest.config.js:** Configuração do Jest para testes unitários.
- **package.json:** Dependências, scripts e metadados do projeto.
- **tsconfig.json:** Configuração do compilador TypeScript.
- **README.md:** Documento de orientação (este arquivo).

### Pasta `bin/`

- **aws-infra-datathon.ts:** Arquivo de entrada da aplicação CDK. Aqui são instanciadas as stacks principais, organizando e inter-relacionando os diferentes recursos (por exemplo, VPC, buckets S3, stacks do ECS, Lambda, etc).

### Pasta `lib/`

#### Stacks

Nesta pasta encontram-se os arquivos de stack que orquestram o provisionamento dos recursos. Exemplos:
- **FastApiStack.ts:** Stack responsável por provisionar serviços relacionados ao FastAPI. Aqui é instanciado, por exemplo, o ECS que roda o serviço containerizado, o ALB para rotear o tráfego, bem como a integração com API Gateway.
- **NextjsAppStack.ts:** Stack que gerencia a infraestrutura destinada à aplicação Next.js. Pode incluir uma instância EC2 configurada para servir o front-end, com regras específicas de subnets e segurança.
- Outras stacks (por exemplo, MLOpsStack, VPCResourcesStack) para agrupar recursos e facilitar a gestão da infraestrutura.

#### Recursos (Pasta `lib/resources/`)

Esta pasta é dividida em subpastas para organizar os recursos conforme o domínio funcional. Exemplos:
- **Ecs/**: Contém o `FastApiEcsStack.ts` que cria e configura o cluster ECS e serviços Fargate para o FastAPI. Aqui você define como o seu serviço é containerizado e escalonado.
- **ALB_ACM/**: Inclui os recursos para gerenciamento do ALB (Application Load Balancer) e certificados gerados via ACM, configurando listeners e regras para HTTPS.
- **Lambda/**: Possui funções Lambda e stacks associadas (por exemplo, `LambdaExportTables.ts`) para processar tarefas serverless.
- **StepFunctions/**: Implementa as máquinas de estado que orquestram fluxos complexos – por exemplo, invocando Lambdas em sequência com delays.
- **S3/**: Contém a stack `DataLakeResources.ts` que define os buckets para armazenamento de dados e de features, configurando regras de ciclo de vida, versionamento e políticas de acesso.
- **Vpc/**: Contém as configurações de VPC e subnets (ex.: `VPCResourcesStack.ts`), definindo a rede isolada onde todos os recursos serão provisionados.
- Outros recursos ajudam na automação de deploys e integrações (por exemplo, pipelines).

### Pasta `src/`

Utilizada para armazenar arquivos de configuração, templates, scripts ou outros assets que alimentam os recursos – por exemplo, arquivos de configuração para o CloudWatch Agent ou scripts utilizados via User Data.

### Pasta `test/`

Contém testes unitários e de integração para validar a infraestrutura provisionada, utilizando frameworks como o Jest.

## Descrição dos Principais Recursos

### VPC e Subnets

A VPC é o backbone da sua infraestrutura, isolando os recursos na AWS.  
- **Subnets Públicas:** Onde recursos que necessitam de acesso direto à Internet (ex.: ALB) são criados.  
- **Subnets Privadas/Isoladas:** Recomendadas para instâncias de aplicação ou bancos de dados que não precisam de um IP público, garantindo maior segurança.  
No seu projeto, a VPC é configurada na stack `VPCResourcesStack.ts`.

### ECS com FastAPI

O ECS (Elastic Container Service) é usado para orquestrar contêineres.  
- **FastApiEcsStack:** Esta stack cria um cluster ECS que executa o serviço FastAPI em containers Fargate.  
- **Propósito:** O serviço FastAPI é responsável por processar requisições da aplicação de forma escalável e eficiente. Ao usar o ECS, você garante que o serviço seja executado com isolamento, gerenciamento de recursos e escalabilidade automática.

### API Gateway e ALB

- **ALB (Application Load Balancer):** Gerencia o tráfego de entrada e distribui as requisições para os serviços (por exemplo, ECS ou instâncias EC2). No seu projeto, o ALB é configurado na pasta `ALB_ACM` para oferecer suporte a HTTPS com certificados do ACM.  
- **API Gateway:** Exponibiliza os endpoints da sua API permitindo integração com outros serviços e limites de tempo de resposta. A escolha entre ALB e API Gateway depende do padrão de acesso e dos requisitos de escalabilidade.

### Lambda e Step Functions

- **Lambda:** Funções serverless utilizadas para tarefas pontuais e assíncronas, como processamento de dados ou chamadas a APIs externas.  
- **Step Functions:** Orquestra fluxos de trabalho complexos. Por exemplo, você utiliza a máquina de estados no `MLOpsStepFunctions.ts` para invocar a Lambda de exportação, aguardar um delay e posteriormente chamar a Lambda de treinamento de modelo. Essa abordagem permite controle refinado de delays e dependências entre tarefas.

### S3 e Data Lake

Os buckets S3 são utilizados para armazenar dados do projeto.  
- **Bucket Principal:** Armazena pastas como raw, processed, models, logs e drift_reports.  
- **Bucket de Features:** Criado separadamente para disponibilizar versionamento específico para arquivos de features. Regras de lifecycle são aplicadas para gerenciar a retenção e expiração de versões, conforme a necessidade do projeto.

## Considerações Finais

Esta infraestrutura foi projetada para oferecer isolamento, escalabilidade e alta disponibilidade para os serviços do seu datathon. A combinação dos recursos – VPC, ECS, ALB, API Gateway, Lambda + Step Functions e S3 – permite orquestrar um ambiente robusto, capaz de processar grandes volumes de dados e executar fluxos complexos de trabalho.

Cada recurso foi escolhido e configurado de forma a atender tanto aos requisitos técnicos quanto às necessidades operacionais, garantindo que o ambiente esteja bem estruturado e seguro.

————————————————————————————  