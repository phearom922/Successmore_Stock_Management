
const router=require('express').Router();
const {z}=require('zod');
const Product=require('../models/Product');
const schema=z.object({sku:z.string(),name:z.string(),baseUom:z.string(),reorderPoint:z.number().nonnegative()});
router.get('/',async(_,res)=>{res.json(await Product.find());});
router.post('/',async(req,res)=>{const p=schema.safeParse(req.body);if(!p.success)return res.status(400).json(p.error);
if(await Product.findOne({sku:p.data.sku}))return res.status(409).json({message:'SKU exists'});
res.status(201).json(await Product.create(p.data));});
router.put('/:id',async(req,res)=>{const p=schema.partial().safeParse(req.body);if(!p.success)return res.status(400).json(p.error);
const doc=await Product.findByIdAndUpdate(req.params.id,p.data,{new:true});if(!doc)return res.status(404).json({message:'Not found'});res.json(doc);});
router.delete('/:id',async(req,res)=>{const d=await Product.findByIdAndDelete(req.params.id);if(!d)return res.status(404).json({message:'Not found'});res.json({success:true});});
module.exports=router;
