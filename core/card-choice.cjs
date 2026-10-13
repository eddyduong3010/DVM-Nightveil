function clickedCard(x,y,game,regions,offered){
  if(!game||game.width<=0||game.height<=0||!Array.isArray(regions))return null;
  const rx=(x-game.x)/game.width,ry=(y-game.y)/game.height;
  const index=regions.findIndex(r=>rx>=r.x&&rx<=r.x+r.w&&ry>=r.y&&ry<=r.y+r.h);
  return index>=0&&offered?.[index]?{id:offered[index],index}:null;
}

function shouldConfirmChoice(choice,count,allChanged,now){
  return !!choice?.id&&count===0&&allChanged&&now>=choice.clickedAt&&now-choice.clickedAt<60000;
}

module.exports={clickedCard,shouldConfirmChoice};
