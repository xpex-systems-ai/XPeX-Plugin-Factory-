type JsonRpcRequest = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };
type ToolCallParams = { name?: unknown; arguments?: unknown };

type Offering = {
  id:string; name:string; category:string; buyers:string[]; needs:string[]; promise:string;
  maturity:string; engagement:string; proof:string[];
};

const offerings:Offering[]=[
  {
    id:"company-intelligence",name:"XPeX Company Intelligence",category:"enterprise-ai",
    buyers:["CTO","CIO","Head of AI","Innovation Lead","Platform Engineering"],
    needs:["inventory systems","map ai stack","prove deployments","company intelligence","technical due diligence","governance","asset discovery","provenance"],
    promise:"Create an evidence-backed map of systems, source, runtime, ownership, agents and open gates before automation expands.",
    maturity:"PILOT READY",engagement:"discovery + evidence audit + control-plane pilot",
    proof:["https://xpex-systems-ai.vercel.app/?system=systems-command","https://xpex-systems-ai.vercel.app/?system=audit-os"]
  },
  {
    id:"agentic-engineering",name:"XPeX Agentic Engineering",category:"agents",
    buyers:["CTO","VP Engineering","Head of AI","AI Platform Team","Developer Tools"],
    needs:["build ai agents","mcp integration","plugin integration","agent tools","agent governance","agent orchestration","codex integration","chatgpt integration"],
    promise:"Turn agent requirements into governed tools, MCP surfaces, skills and evidence-backed system integrations.",
    maturity:"DEMO + PILOT",engagement:"agent architecture + MCP/plugin implementation + governance",
    proof:["https://xpex-systems-ai.vercel.app/?system=plugin-factory","https://xpex-systems-ai.vercel.app/api/mcp/gx"]
  },
  {
    id:"digital-worker-composition",name:"Neural Workforce / Digital Worker Composition",category:"neural-workforce",
    buyers:["COO","Innovation Lead","Operations","SMB Platform","Vertical SaaS"],
    needs:["digital worker","automate workflow","combine apps","ai workforce","workflow agent","human in the loop","specialized agent"],
    promise:"Compose existing applications, skills and governed agents into specialized digital workers that expand human capability.",
    maturity:"DESIGN + WORKING BUILDING BLOCKS",engagement:"workflow decomposition + capability graph + digital-worker blueprint",
    proof:["https://github.com/xpex-systems-ai/xpex-systems-ai/blob/main/NEURAL_WORKFORCE_MANIFESTO.md","https://xpex-plugin-factory-production.up.railway.app"]
  },
  {
    id:"enterprise-audit",name:"GXEON Evidence Audit",category:"audit",
    buyers:["Founder","CTO","Technical Investor","Accelerator","Security Lead"],
    needs:["audit ai company","verify product","technical audit","due diligence","evidence review","runtime verification","portfolio audit"],
    promise:"Separate deployed, inferred, duplicated and planned assets into a reviewable evidence map.",
    maturity:"DEMO READY",engagement:"read-only discovery + technical evidence report",
    proof:["https://gxeon-audit-os.vercel.app","https://github.com/xpex-systems-ai/xpex-systems-ai/blob/main/docs/FLAGSHIP_CASES.md"]
  },
  {
    id:"agent-distribution",name:"XPeX Agent & API Distribution",category:"distribution",
    buyers:["Agent Platform","AI Marketplace","API Marketplace","Developer Platform","Enterprise Innovation"],
    needs:["distribute agents","agent marketplace","sell agent services","api marketplace","machine service","agent discovery","mcp marketplace"],
    promise:"Package machine-consumable services with discovery, evidence, policy boundaries and commercial admission gates.",
    maturity:"ADMISSION / PILOT",engagement:"service packaging + MCP/API discovery + marketplace integration",
    proof:["https://xpex-systems-ai.vercel.app/?system=api-fabric","https://xpex-systems-ai.vercel.app/?system=wallet-command"]
  },
  {
    id:"ai-learning",name:"XPeX Applied AI Learning",category:"education",
    buyers:["Education Provider","Training Organization","Corporate L&D","School","Community Program"],
    needs:["ai training","student ai lab","agent education","applied ai course","workforce reskilling","learning platform"],
    promise:"Move learners from AI concepts into applied projects, labs and production-oriented workflows.",
    maturity:"RUNTIME CORRELATION",engagement:"education architecture + applied AI curriculum/platform pilot",
    proof:["https://xpex-systems-ai.vercel.app/?system=academy","https://github.com/xpex-systems-ai/XPEX-ACADEMY"]
  },
  {
    id:"ai-creation-control-plane",name:"XPeX AI Creation Control Plane",category:"creative-ai",
    buyers:["Creative Team","Agency","Media Company","Marketing Operations","Creator Platform"],
    needs:["ai studio","creative agents","content workflow","memory core","agent creative workflow","ai creation platform"],
    promise:"Unify AI creation, agent operations and memory-oriented workflows behind one control-plane experience.",
    maturity:"DEMO READY",engagement:"creative workflow pilot + agent/tool integration",
    proof:["https://xpex-studio-ai.vercel.app","https://xpex-systems-ai.vercel.app/?system=studio-ai"]
  }
];

const contact={
  company:"XPeX Systems AI",
  website:"https://xpex-systems-ai.vercel.app",
  linkedin:"https://www.linkedin.com/in/ceojuniorsena",
  github:"https://github.com/xpex-systems-ai/xpex-systems-ai"
};

function normalize(v:unknown){return String(v??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s./_-]/g," ");}
function tokens(v:unknown){return [...new Set(normalize(v).split(/\s+/).filter(x=>x.length>1))];}
function score(query:string,o:Offering){
  const hay=normalize([o.name,o.category,...o.buyers,...o.needs,o.promise,o.engagement].join(" "));
  return tokens(query).reduce((n,t)=>n+(hay.includes(t)?(t.length>=7?4:t.length>=4?2:1):0),0);
}
function match(args:Record<string,unknown>){
  const query=[args.need,args.company_type,args.goals,args.constraints].filter(Boolean).join(" ");
  const ranked=offerings.map(o=>({...o,score:score(query,o)})).sort((a,b)=>b.score-a.score);
  const selected=ranked.filter(x=>x.score>0).slice(0,4);
  return selected.length?selected:ranked.slice(0,3);
}
function toolResult(structuredContent:unknown){return {content:[{type:"text",text:JSON.stringify(structuredContent)}],structuredContent,isError:false};}
function toolError(code:string,message:string,details?:unknown){const structuredContent={error:code,message,...(details===undefined?{}:{details})};return {content:[{type:"text",text:JSON.stringify(structuredContent)}],structuredContent,isError:true};}
function argsOf(params:ToolCallParams){return params.arguments&&typeof params.arguments==="object"&&!Array.isArray(params.arguments)?params.arguments as Record<string,unknown>:{};}

const tools=[
  {
    name:"xpex_enterprise_discover",title:"Discover XPeX enterprise capabilities",
    description:"Return the machine-readable XPeX enterprise discovery manifest and public handoff.",
    inputSchema:{type:"object",properties:{},additionalProperties:false},
    securitySchemes:[{type:"noauth"}],annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}
  },
  {
    name:"xpex_enterprise_match_need",title:"Match a real company need",
    description:"Match an enterprise, agent-platform, accelerator or AI-team need to evidence-backed XPeX capabilities.",
    inputSchema:{type:"object",required:["need"],additionalProperties:false,properties:{need:{type:"string"},company_type:{type:"string"},goals:{type:"string"},constraints:{type:"string"}}},
    securitySchemes:[{type:"noauth"}],annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}
  },
  {
    name:"xpex_enterprise_get_solution_pack",title:"Get an XPeX solution pack",
    description:"Return one offering with maturity, engagement model and public proof links.",
    inputSchema:{type:"object",required:["offering_id"],additionalProperties:false,properties:{offering_id:{type:"string"}}},
    securitySchemes:[{type:"noauth"}],annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}
  },
  {
    name:"xpex_enterprise_get_agent_assets",title:"Discover XPeX agent assets",
    description:"Return public agent/plugin/MCP assets that an enterprise or agent platform can inspect.",
    inputSchema:{type:"object",properties:{},additionalProperties:false},
    securitySchemes:[{type:"noauth"}],annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}
  },
  {
    name:"xpex_enterprise_get_demo_pack",title:"Get technical demo evidence",
    description:"Return the strongest public XPeX demo and technical evidence links.",
    inputSchema:{type:"object",properties:{offering_id:{type:"string"}},additionalProperties:false},
    securitySchemes:[{type:"noauth"}],annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}
  },
  {
    name:"xpex_enterprise_prepare_pilot",title:"Prepare an Evidence First pilot",
    description:"Prepare a bounded pilot blueprint. This is a plan, not a contract or guaranteed result.",
    inputSchema:{type:"object",additionalProperties:false,properties:{offering_id:{type:"string"},need:{type:"string"},company_type:{type:"string"},constraints:{type:"string"}}},
    securitySchemes:[{type:"noauth"}],annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}
  },
  {
    name:"xpex_enterprise_get_fit",title:"Explain enterprise fit",
    description:"Explain why an XPeX offering fits a buyer profile while preserving maturity limits.",
    inputSchema:{type:"object",required:["offering_id"],additionalProperties:false,properties:{offering_id:{type:"string"},buyer:{type:"string"}}},
    securitySchemes:[{type:"noauth"}],annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}
  },
  {
    name:"xpex_enterprise_contact_handoff",title:"Get XPeX contact handoff",
    description:"Return canonical public contact and evidence-review links for an interested evaluator.",
    inputSchema:{type:"object",properties:{context:{type:"string"}},additionalProperties:false},
    securitySchemes:[{type:"noauth"}],annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}
  }
];

async function callTool(params:ToolCallParams){
  const name=typeof params.name==="string"?params.name:"";
  const args=argsOf(params);

  if(name==="xpex_enterprise_discover") return toolResult({
    name:"XPeX Enterprise Agent API",version:"1.0.0",policy:"Evidence First",
    offerings:offerings.map(o=>({id:o.id,name:o.name,category:o.category,maturity:o.maturity})),
    endpoints:{
      enterpriseMcp:"https://xpex-plugin-factory-production.up.railway.app/enterprise/mcp",
      gxMcp:"https://xpex-systems-ai.vercel.app/api/mcp/gx",
      website:"https://xpex-systems-ai.vercel.app"
    },contact,
    truthBoundary:"Discovery does not imply a customer, partner, investor, procurement or commercial relationship."
  });

  if(name==="xpex_enterprise_match_need"){
    const matches=match(args);
    return toolResult({
      query:args,
      matches:matches.map(x=>({id:x.id,name:x.name,maturity:x.maturity,promise:x.promise,engagement:x.engagement,proof:x.proof,score:x.score})),
      truthBoundary:"A capability match is advisory and is not a sale, contract or guaranteed outcome."
    });
  }

  const id=typeof args.offering_id==="string"?args.offering_id:"";
  const offering=offerings.find(o=>o.id===id);

  if(name==="xpex_enterprise_get_solution_pack"){
    return offering?toolResult({offering,contact,truthBoundary:"Solution pack != customer deployment or signed contract."}):toolError("UNKNOWN_OFFERING","Unknown offering_id",{available:offerings.map(o=>o.id)});
  }

  if(name==="xpex_enterprise_get_agent_assets") return toolResult({
    assets:[
      {name:"GX Neural Copilot",type:"plugin+mcp",endpoint:"https://xpex-systems-ai.vercel.app/api/mcp/gx",state:"PRODUCTION READY / READ ONLY"},
      {name:"XPeX Plugin Factory",type:"compiler+mcp",endpoint:"https://xpex-plugin-factory-production.up.railway.app/mcp",state:"DEMO READY"},
      {name:"XPeX Enterprise Agent API",type:"enterprise-discovery+mcp",endpoint:"https://xpex-plugin-factory-production.up.railway.app/enterprise/mcp",state:"PUBLIC DISCOVERY"}
    ],
    policy:"Evidence First"
  });

  if(name==="xpex_enterprise_get_demo_pack"){
    return toolResult({
      offering:offering?{id:offering.id,name:offering.name,maturity:offering.maturity}:null,
      proof:offering?.proof??[
        "https://xpex-systems-ai.vercel.app",
        "https://github.com/xpex-systems-ai/xpex-systems-ai/blob/main/docs/FLAGSHIP_CASES.md",
        "https://xpex-plugin-factory-production.up.railway.app"
      ],
      companySite:"https://xpex-systems-ai.vercel.app",
      flagshipCases:"https://github.com/xpex-systems-ai/xpex-systems-ai/blob/main/docs/FLAGSHIP_CASES.md"
    });
  }

  if(name==="xpex_enterprise_prepare_pilot"){
    const chosen=offering??match(args)[0];
    return chosen?toolResult({
      offering_id:chosen.id,title:chosen.name+" — Evidence First Pilot",objective:chosen.promise,
      phases:["Discovery: map workflow, systems, data classes and success criteria.","Design: define capability graph, tools/MCP, permissions and human approvals.","Build: implement the smallest useful bounded integration.","Verify: run tests, evidence checks, runtime validation and operator review.","Promote: move only verified capabilities forward under explicit approval."],
      deliverables:["current-state map","capability blueprint","integration prototype","evidence pack","open-gate list","production admission plan"],
      truthBoundary:"Pilot blueprint != signed pilot, guaranteed ROI or guaranteed outcome.",contact
    }):toolError("NO_MATCH","Unable to prepare a pilot.");
  }

  if(name==="xpex_enterprise_get_fit"){
    return offering?toolResult({offering:{id:offering.id,name:offering.name,maturity:offering.maturity},buyer:args.buyer??"unspecified evaluator",whyFit:offering.promise,buyerProfiles:offering.buyers,engagement:offering.engagement,proof:offering.proof,currentLimit:"Inspect live evidence and open gates before production/procurement claims."}):toolError("UNKNOWN_OFFERING","Unknown offering_id");
  }

  if(name==="xpex_enterprise_contact_handoff") return toolResult({context:args.context??null,contact,recommendedMessage:"I reviewed the XPeX evidence pack and would like to discuss an enterprise/agent integration or pilot.",inspectionOrder:[contact.website,"https://github.com/xpex-systems-ai/xpex-systems-ai/blob/main/docs/FLAGSHIP_CASES.md","https://xpex-systems-ai.vercel.app/api/mcp/gx",contact.linkedin]});

  return toolError("UNKNOWN_TOOL",`Unknown Enterprise Agent API tool: ${name||"(missing)"}`);
}

export function getEnterpriseMcpDescriptor(){
  return {name:"xpex-enterprise-agent-api",version:"1.0.0",protocol:"MCP Streamable HTTP",endpoint:"/enterprise/mcp",transport:"streamable-http",authentication:"none",tools:tools.map(t=>t.name),offerings:offerings.length,scope:"Read-only enterprise discovery, evidence-backed need matching, agent asset distribution and pilot preparation."};
}

export async function handleEnterpriseMcp(body:unknown){
  const request=body as JsonRpcRequest;
  if(!request||request.jsonrpc!=="2.0"||typeof request.method!=="string") return {status:400,body:{jsonrpc:"2.0",id:request?.id??null,error:{code:-32600,message:"Invalid Request"}}};
  if(request.method==="notifications/initialized") return {status:202,body:null};
  if(request.method==="initialize") return {status:200,body:{jsonrpc:"2.0",id:request.id??null,result:{protocolVersion:"2025-11-25",capabilities:{tools:{listChanged:false}},serverInfo:{name:"xpex-enterprise-agent-api",version:"1.0.0"},instructions:"Match real enterprise needs to evidence-backed XPeX capabilities. Never invent customers, partnerships, procurement, revenue or guaranteed outcomes."}}};
  if(request.method==="ping") return {status:200,body:{jsonrpc:"2.0",id:request.id??null,result:{}}};
  if(request.method==="tools/list") return {status:200,body:{jsonrpc:"2.0",id:request.id??null,result:{tools}}};
  if(request.method==="tools/call"){
    const params=request.params&&typeof request.params==="object"&&!Array.isArray(request.params)?request.params as ToolCallParams:{};
    return {status:200,body:{jsonrpc:"2.0",id:request.id??null,result:await callTool(params)}};
  }
  return {status:200,body:{jsonrpc:"2.0",id:request.id??null,error:{code:-32601,message:"Method not found"}}};
}
