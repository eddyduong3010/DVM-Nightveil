function isRecommendationSource(value){
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)return false;
  return u.hostname==='developer.riotgames.com'&&u.pathname==='/docs/lol'||u.hostname==='arammayhem.com'&&u.pathname==='/data/'||u.hostname==='op.gg'&&u.pathname.startsWith('/lol/modes/aram-mayhem/')||u.hostname==='ddragon.leagueoflegends.com'&&/^\/cdn\/\d+\.\d+\.\d+\/data\/en_US\/(item\.json|champion\/[A-Za-z]+\.json)$/.test(u.pathname);
 }catch{return false;}
}
module.exports={isRecommendationSource};
