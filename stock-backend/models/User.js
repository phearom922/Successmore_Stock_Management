
const mongoose=require('mongoose');const bcrypt=require('bcryptjs');
const schema=new mongoose.Schema({username:{type:String,unique:true},password:String,role:{type:String,default:'admin'}},{timestamps:true});
schema.pre('save',async function(next){if(!this.isModified('password'))return next();this.password=await bcrypt.hash(this.password,10);next();});
schema.methods.compare=function(pw){return bcrypt.compare(pw,this.password);};
module.exports=mongoose.model('User',schema);
