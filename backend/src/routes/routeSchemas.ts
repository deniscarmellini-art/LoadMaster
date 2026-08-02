export const idParamsSchema={type:"object",additionalProperties:false,required:["id"],properties:{id:{type:"string",minLength:1,maxLength:100}}} as const;
export const commonProperties={id:{type:"string",minLength:1,maxLength:100},active:{type:"boolean"},sortOrder:{type:"integer",minimum:0}} as const;
