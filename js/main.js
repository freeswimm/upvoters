$(function () {

var userData = null;
var steemData = null; 
var userPosts = null;
var userVoters = [];
var totalReward = 0;
var account, movementGlobal, powerGlobal,  accountGests;
var $grid = null;

// --------Settings-------------

var pingInterval = 6000; 
var COOKIE_EXPIRES = 360; 
var postCount = 5; 
var holder_reward = 15; 
var inflation_rate = 15; 

var DOMAIN = 'https://steemit.com/';
var debug = true;
// ------------------------------

//---- Color themes ----

var color_theme = {
    black : { min : -100, max : -0.1  },
    grey : { min : 0, max : 0.1  },
    fog : { min : 0.11, max : 1 },
    sea : { min : 1.1, max : 5 },
    green : { min : 5.1, max : 25 },  
    orange : { min : 25.1, max : 100 }
}


var now = new Date(); // 2000-12-31T00:00:00'
var curDate = now.getFullYear()+'-'+now.getMonth()+'-'+now.getDate()+'T'+now.getHours()+':'+now.getMinutes()+':'+now.getSeconds();  

var account = $('#user').val();

$('.tooltip').tooltipster();

$('.settings-submit').on('click',function(){  
    if ($('#user').val() !== '') { 
        Cookies.set('user', $('#user').val(), {expires: COOKIE_EXPIRES});  
        Cookies.set('post_count', $('#post_count').val(), {expires: COOKIE_EXPIRES});  
        loadingShow(true);
        init();  
        $('.settings-submit').hide();
    } else {
        alert('Input user name.');
    }
});

$('#user, #post_count').on('focus', function(){    
    $('.settings-submit').show();
});
$('.settings-submit').on('click', function(){
    $(this).hide();
});

$('#user').on('change',function(){  
    if ($('#user').val() !== '') { 
        Cookies.set('user', $(this).val(), {expires: COOKIE_EXPIRES});  
        loadingShow(true);
        init();  
    } else {
        alert('Input user name.');
    }
});

// sort
$('#filter_form .radio').on('click', function(){ 
    if($grid !== null){
        $grid.isotope({ sortBy: [$(this).val(), 'reward'] });
    }      
});

if((Cookies.get('user') !== 'null') && (Cookies.get('user') !== undefined)){
    $('#user').val(Cookies.get('user'));       
}
if((Cookies.get('post_count') !== 'null') && (Cookies.get('post_count') !== undefined)){
    $('#post_count').val(Cookies.get('post_count'));       
} else {
    $('#post_count').val(postCount);
}
$('.grid').on('click', '.grid-item', function(){
    window.open($(this).data('link'), '_blank');  
});

if ($('#user').val() !== '') { 
    loadingShow(true);
    init();  
}

setInterval(function () { 
     init();
}, pingInterval*1000);

function init(){
    account = $('#user').val();    
    if (account !== ''){            
         mainStream();
    }else{
        $('.voter-column, .info-header').hide();
        alert('Input user name.');
    }   
}
 
function loadingShow(type){
    if(type === true){       
        $('.voter-column, .info-header').hide();
        $('body').before('<div class="overlay"></div><div class="pre-loader"></div>');
        $('.dev-label').hide(); 
    } else {
        $('.dev-label').show(); 
        $('.overlay, .pre-loader').remove();
        $('.tooltip').tooltipster();
    }    
}

function mainStream(){
    getGlobalData(function(gls_data){
        steemData = gls_data;
        //_d(gls_data);
        getAccountData(function(acc_data){ 
            if(acc_data.length > 0){                
                $('#profile_caption').text(account);
                userData = acc_data;  
               //_d(acc_data);
                showInfo();
            } else {
               $('.voter-column, .info-header').hide();
               $('.overlay, .pre-loader').remove();
               alert('User not found.');
            }            
        });
    });    
      
    Promise.all([getUserPosts()])
    .then(getCurators)
   .then(function(){renderTable();})
    .then(function(){  loadingShow(false); })
    .catch(function(error) { $('#errors').html(error); }); 
}

function getUserPosts(){
    return new Promise(function(resolve, reject) {
        steem.api.getDiscussionsByAuthorBeforeDate(account, '', curDate, postCount, function(err, results) {      
            if(err === null){
                userPosts = results;
                resolve(results);                
            } else {
                reject(err);
            }
        });
    });    
}

function getCurators(){
    userVoters = [];
    totalReward = 0;
    return new Promise(function(resolve, reject) {
        if(userPosts !== null && (userPosts[0] !== undefined)){
            posts = userPosts;    
            if(posts.length > 0){          
               
                posts.forEach(function(post){                   
                    totalReward +=  getPostPayout(post);                 
                });

            
                posts.forEach(function(post){
                                
                    if(post.active_votes !== undefined){                        
                        
                        if(post.active_votes.length > 0){     
                            
                            var post_rshares = getPostRshares(post);
                            var post_payout_value = getPostPayout(post);                                           
                        
                            post.active_votes.forEach(function(item){
                               
                                if(userVoters[item.voter] === undefined){
                                    userVoters[item.voter] = {
                                        name:item.voter,
                                        rshares:item.rshares,
                                        upvote_power_perc:item.percent/100,
                                        cnt:1,
                                        upvote_reward:getReward(post_payout_value, post_rshares, item.rshares) 
                                    };
                                } else {
                                    userVoters[item.voter] = {
                                        name:item.voter,
                                        rshares : userVoters[item.voter].rshares*1 + item.rshares*1,
                                        upvote_power_perc : ((userVoters[item.voter].upvote_power_perc*1 + (item.percent/100))/2).toFixed(2),
                                        cnt : ++userVoters[item.voter].cnt,  
                                        upvote_reward : userVoters[item.voter].upvote_reward*1 + getReward(post_payout_value, post_rshares, item.rshares)
                                    };
                                }                                   
                            });
                        }
                    }
                });
                
                steem.api.getAccounts(Object.keys(userVoters), function(err, voters_data){
                    if(err === null){ 
                        if(voters_data.length > 0){
                            voters_data.forEach(function(profile){
                                if(profile.name in userVoters){
                                    userVoters[profile.name].avatar = getAvatar(profile);
                                    userVoters[profile.name].reputation = getReputation(profile.reputation);
                                    userVoters[profile.name].link = DOMAIN+'@'+profile.name;                                  
                                    userVoters[profile.name].curation_rate = (((userVoters[profile.name].upvote_reward*1)/totalReward)*100).toFixed(1); // общий рейтинг куратора по кол-ву вознаграждения
                                }                            
                            });
                        }
                        
                    }else{
                        $('#errors').html(err);   
                        reject(new Error(err));
                    }
                    resolve(userVoters);
                });
               
            } else {
                reject(new Error("You haven't any post"));
            }
        }
    });
}

function getColorByRate(rate){    
    for(color in color_theme){
        if((color_theme[color].min <= rate*1) && (color_theme[color].max >= rate*1)){
            return color;
        }
    }
}

function renderTable(){
    return new Promise(function(resolve, reject) {
       
        var rows = '';
        if(Object.keys(userVoters).length > 0){
            
            for( var prop in userVoters) { 
                if(userVoters.hasOwnProperty(prop)) {
                    var color_class = getColorByRate(userVoters[prop].curation_rate)+'-palette';
                    var reward = (userVoters[prop].upvote_reward).toFixed(2);  
                    var reputation = (1*userVoters[prop].reputation).toFixed(0);
                    var avatar = (userVoters[prop].avatar == false) ? 'img/blanc.png' : 'https://steemitimages.com/120x120/'+userVoters[prop].avatar;
                    var sp_average = (1*userVoters[prop].upvote_power_perc).toFixed(0);
                    rows += '<div class="grid-item '+color_class+'" data-link="'+userVoters[prop].link+'" data-average_sp="'+sp_average+'" data-upvotes_cnt="'+userVoters[prop].cnt+'" data-reward="'+reward+'"><div class="grid-item-header"><div class="grid-item-header-text">'+userVoters[prop].name+'</div><div class="voter-reputation tooltip" title="Reputation of curator">'+reputation+'</div></div>  <div class="grid-item-body"><div class="grid-item-vote-cnt"><span class="upvotes-cnt tooltip" title="Quantity of posts uvoted by curator">'+userVoters[prop].cnt+'</span><span> of </span><span class="tooltip" title="Quantity of last created/updated posts">'+postCount+'</span></div><div class="grid-item-footer"><div class="tooltip" title="Average % of upvote for this curator"><div> Average Steem Power </div><div class="average-sp"> '+sp_average+'% </div></div><div class="tooltip" title="SBD amount by this curator by last '+userVoters[prop].cnt+' posts"><div> Total SBD </div><div class="total-reward">'+reward+'</div></div><div class="tooltip" title="Curator\'s share in rewards distribution by last'+userVoters[prop].cnt+' posts"><div class="total-upvotes-weight"> Total weight </div><div> '+userVoters[prop].curation_rate+'% </div></div></div></div> <div class="img-circle wrap-ava" style="background: url('+avatar+') no-repeat #ffffff; "></div><div class="img-circle wrap-ava-2" ></div></div>';

                    //rows += '<div class="grid-item '+color_class+'" data-link="'+userVoters[prop].link+'" data-reward="'+reward+'"><div class="grid-item-header"><div class="grid-item-header-text">'+userVoters[prop].name+'</div></div>  <div class="grid-item-body"><div class="grid-item-vote-cnt"><span class="upvotes-cnt">'+userVoters[prop].cnt+'</span><span>/</span><span>'+postCount+'</span></div><div class="grid-item-footer"><div><div> Average SP </div><div class="average-sp"> '+sp_average+'% </div></div><div><div> Total SBD </div><div class="total-reward">'+reward+'</div></div><div><div class="total-upvotes-weight"> Avg weight </div><div> '+userVoters[prop].curation_rate+'% </div></div></div></div> <div class="img-circle wrap-ava" style="background: url('+avatar+') no-repeat #ffffff; "></div><div class="img-circle wrap-ava-2" ></div></div>';
                }
            }
            
            var reinit = ($('.grid').html() !== '') ? true : false;             
            $('.grid').html(rows);               
            if(reinit){
                $('.grid').isotope('reloadItems');
            }
            $('.voter-column, .info-header').show();
            $grid = $('.grid').isotope({              
              itemSelector: '.grid-item',
              percentPosition: true,
              layoutMode: 'fitRows',
              getSortData: {               
                reward:"[data-reward] parseFloat",
                 average_sp:"[data-average_sp] parseFloat",
                upvotes_cnt:"[data-upvotes_cnt] parseFloat",
              },
              sortBy: 'reward',
              sortAscending: { reward: false, upvotes_cnt: false, average_sp: false }
            });                
           
        }
        resolve(1);
    });
}

function getAvatar(acc) {
    try {
        if (('json_metadata' in acc)) {
            var metadata = $.parseJSON(acc.json_metadata);
            if ('profile' in metadata) {
                if ('profile_image' in metadata.profile) {
                    return metadata.profile.profile_image;
                }
            }
        }
    } catch (e) {
        //_d('json parse error '+e.message);
        return false;
    }
    return false;
}

function getPostRshares(post){
    
    if(post.abs_rshares > 0){
        return post.abs_rshares;
    } else {
        var sum_curators_rshares = 0;
        post.active_votes.forEach(function(item){
            sum_curators_rshares += item.rshares*1;
        });
        return sum_curators_rshares;
    }   
}

function getReward(post_payout, post_rshares, upvote_rshare){    
    return (((upvote_rshare/post_rshares)*post_payout).toFixed(3))*1;
}

function getPostPayout(post){   
    var split_pending_payout = (post.pending_payout_value).split(' ');
    var split_total_payout = (post.total_payout_value).split(' ');
    var payout =  (split_pending_payout[0]*1 > 0) ? split_pending_payout[0]*1 : split_total_payout[0]*1;   
   
    return payout;
}

function getGlobalData(callback){
    steem.api.getDynamicGlobalProperties(function(err, result) {
        if(err === null){
            callback(result);
        }else{
            $('#errors').html(err); 
            getGlobalData(callback);
        }        
    });
}

function getAccountData(callback){
    steem.api.getAccounts([account], function(err, response){
        if(err === null){            
            callback(response);
        }else{
            $('#errors').html(err);            
            getAccountData(callback);
        }
    });
}

function showInfo(){
    if(userData.length > 0){
                      
        accountGests = userData[0].vesting_shares.split(' ')[0];
        $('#gests').html((accountGests/1000000).toFixed(3));
        $('#voting_power').html((userData[0].voting_power/100).toFixed(2)+'%');
              
        var metadata = JSON.parse(userData[0].json_metadata);
        if(metadata.profile !== undefined){
            if(metadata.profile.profile_image !== undefined){
                $('#main-avatar').attr('style', 'background: url(https://steemitimages.com/120x120/'+metadata.profile.profile_image+') no-repeat;'); 
            }else{
                $('#main-avatar').attr('style', 'background: url(img/blanc.png)  no-repeat;');
            }
        }else{
            $('#main-avatar').attr('style', 'background: url(img/blanc.png)  no-repeat;');
        }       
     
        $('#reputation').html(getReputation(userData[0].reputation));
             
        if(steemData !== null){
            movementGlobal = steemData.total_vesting_shares.split(' ')[0];
            powerGlobal = steemData.total_vesting_fund_steem.split(' ')[0];
            $('#power').html((powerGlobal * (accountGests / movementGlobal)).toFixed(3));
        }   
      
        $('#power').html(getPower());
                      
        //_d(steem.formatter.vestToSteem(userData[0].reputation));
        showRewardsGrid();       
    }
}

function showRewardsGrid(){
    if(steemData !== null){
             
        var current_supply = steemData.current_supply.split(' ')[0];
                        
        var total_year_delta = current_supply*inflation_rate/100;
                
        var account_power_share = getPower()/current_supply;
               
        var golos_holder_year_rewards = total_year_delta*holder_reward/100;
       
        $('.profit-line-box #year-profit').text((golos_holder_year_rewards*account_power_share).toFixed(3));
        $('.profit-line-box #month-profit').text((golos_holder_year_rewards*account_power_share*30/365).toFixed(3));
        $('.profit-line-box #week-profit').text((golos_holder_year_rewards*account_power_share/52).toFixed(3));
        $('.profit-line-box #day-profit').text((golos_holder_year_rewards*account_power_share/365).toFixed(3));
        $('.profit-line-box #hour-profit').text((golos_holder_year_rewards*account_power_share/(365*24)).toFixed(3));
        //_d(golos_holder_year_rewards*account_power_share, golos_holder_year_rewards, total_year_delta);
    } 
}

function getPower(){
    
    if(steemData !== null){
        movementGlobal = steemData.total_vesting_shares.split(' ')[0];
        powerGlobal = steemData.total_vesting_fund_steem.split(' ')[0];
        return (powerGlobal * (accountGests / movementGlobal)).toFixed(3);        
    }else{
        return 0;
    }    
}

function getReputation(crude_rep){
    crude_rep = crude_rep+'';    
    if(isNaN(crude_rep)){ crude_rep = 0;}
    var is_negative = crude_rep.charAt(0) === '-';
  
    crude_rep = is_negative ? crude_rep.substr(1): crude_rep;
    var out = Math.log10(crude_rep);
    out = Math.max(out - 9, 0);
    out = (is_negative ? -1 : 1)*out;
    out = (out * 9) + 25; 
    
    return out.toFixed(2);
}

$('.dev-label').on('click', function(){
    window.open('https://steemit.com/@elviento', '_blank');
});

function _d(param){
    if(debug){
        console.log(param);
    }
}   

});