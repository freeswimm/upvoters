$(function () {

var userData = null;
var golosData = null; 
var userPosts = null;
var userVoters = [];
var totalReward = 0;
var account, movementGlobal, powerGlobal,  accountGests;

// --------Настройки-------------

var pingInterval = 6000; // пинг в секундах
var COOKIE_EXPIRES = 360;  // время действия всех кук в днях
var postCount = 5; // кол-во последних постов
var holder_reward = 15; // % награды держателям голоса
var inflation_rate = 15; // Годовая инфляция:

var WS = 'wss://ws.golos.io';
var DOMAIN = 'https://golos.io/';
var debug = true;
// ------------------------------

//---- Цветовые схемы плиток ----

var color_theme = {
    black : { min : -100, max : -0.1  },
    grey : { min : 0, max : 0.1  },
    fog : { min : 0.11, max : 1 },
    sea : { min : 1.1, max : 5 },
    green : { min : 5.1, max : 25 },  
    orange : { min : 25.1, max : 100 }
}


// установить текушую дату
var now = new Date(); // 2000-12-31T00:00:00'
var curDate = now.getFullYear()+'-'+now.getMonth()+'-'+now.getDate()+'T'+now.getHours()+':'+now.getMinutes()+':'+now.getSeconds();  

var account = $('#user').val();

steem.api.setWebSocket(WS);


$('#user').on('change',function(){  
    if ($('#user').val() !== '') { 
        Cookies.set('user', $(this).val(), {expires: COOKIE_EXPIRES});  
        loadingShow(true);
        init();  
    } else {
        alert('Введите имя пользователя.');
    }
});

if((Cookies.get('user') !== 'null') && (Cookies.get('user') !== undefined)){
    $('#user').val(Cookies.get('user'));       
}

// переход на профайл куратора
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
        alert('Введите имя пользователя');
    }   
}
 
function loadingShow(type){
    if(type === true){       
        $('.voter-column, .info-header').hide();
        $('body').before('<div class="overlay"></div><div class="pre-loader"></div>');
    } else {
       $('.overlay, .pre-loader').remove();
    }    
}

function mainStream(){
    getGlobalData(function(gls_data){
        golosData = gls_data;
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
               alert('Пользователь не найден');
            }            
        });
    });    
    
    // создать объекты с кураторами и внести их в таблицу gui 
    Promise.all([getUserPosts()])
    .then(getCurators)
    .then(renderTable)
    .then(function(){  loadingShow(false); })
    .catch(function(error) { $('#errors').html(error); }); 
}

// вернуть последние postCount постов юзера
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

// создать объекты с кураторами
function getCurators(){
    userVoters = [];
    totalReward = 0;
    return new Promise(function(resolve, reject) {
        if(userPosts !== null && (userPosts[0] !== undefined)){
            posts = userPosts;    
            if(posts.length > 0){          
                // считаем общую награду за все посты      
                posts.forEach(function(post){                   
                    totalReward +=  getPostPayout(post);                 
                });

                // создает объект с данными для каждого куратора
                posts.forEach(function(post){
                                
                    if(post.active_votes !== undefined){                        
                        
                        if(post.active_votes.length > 0){     
                            
                            var post_rshares = getPostShares(post);
                            var post_payout_value = getPostPayout(post);
                                                       
                            // выбрать кураторов из каждого поста
                            post.active_votes.forEach(function(item){
                                // 
                                if(userVoters[item.voter] === undefined){
                                    userVoters[item.voter] = {
                                        name:item.voter,
                                        rshares:item.rshares,
                                        upvote_power_perc:item.percent/100,
                                        cnt:1,
                                        upvote_reward:getReward(post_payout_value, post_rshares, item.rshares) //post_payout, post_rshares, upvote_rshare
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

                // добавить аватары и линки на профайл кураторов                   
                steem.api.getAccounts(Object.keys(userVoters), function(err, voters_data){
                    if(err === null){ 
                        if(voters_data.length > 0){
                            voters_data.forEach(function(profile){
                                if(profile.name in userVoters){
                                    userVoters[profile.name].avatar = getAvatar(profile);
                                    userVoters[profile.name].link = DOMAIN+'@'+profile.name;
                                    userVoters[profile.name].curation_rate = (((userVoters[profile.name].upvote_reward*1)/totalReward)*100).toFixed(1); // общий рейтинг куратора по кол-ву вознаграждения
                                }                            
                            });
                        }
                        //_d(voters_data);
                    }else{
                        $('#errors').html(err);   
                        reject(new Error(err));
                    }
                    resolve(userVoters);
                });
               
            } else {
                reject(new Error("У вас нет постов"));
            }
        }
    });
}

// определяет цвет плитки по рейттингу
function getColorByRate(rate){    
    for(color in color_theme){
        if((color_theme[color].min <= rate*1) && (color_theme[color].max >= rate*1)){
            return color;
        }
    }
}

// создать таблицу с кураторами
function renderTable(){
    return new Promise(function(resolve, reject) {
       
        var rows = '';
        if(Object.keys(userVoters).length > 0){
            
            for( var prop in userVoters) { 
                if(userVoters.hasOwnProperty(prop)) {
                    var color_class = getColorByRate(userVoters[prop].curation_rate)+'-palette';
                    var reward = (userVoters[prop].upvote_reward).toFixed(2);                        
                    var avatar = (userVoters[prop].avatar == false) ? 'img/blanc.png' : 'https://imgp.golos.io/120x120/'+userVoters[prop].avatar;
                    var sp_average = (1*userVoters[prop].upvote_power_perc).toFixed(0);
                    rows += '<div class="grid-item '+color_class+'" data-link="'+userVoters[prop].link+'" data-reward="'+reward+'"><div class="grid-item-header"><div class="grid-item-header-text">'+userVoters[prop].name+'</div></div>  <div class="grid-item-body"><div class="grid-item-vote-cnt"><span class="upvotes-cnt">'+userVoters[prop].cnt+'</span><span>/</span><span>'+postCount+'</span></div><div class="grid-item-footer"><div><div> Средняя СГ </div><div class="average-sp"> '+sp_average+'% </div></div><div><div> Всего GBG </div><div class="total-reward">'+reward+'</div></div><div><div class="total-upvotes-weight"> Общий вес </div><div> '+userVoters[prop].curation_rate+'% </div></div></div></div> <div class="img-circle wrap-ava" style="background: url('+avatar+') no-repeat #ffffff; "></div><div class="img-circle wrap-ava-2" ></div></div>';
                }
            }
            
            var reinit = ($('.grid').html() !== '') ? true : false;             
            $('.grid').html(rows);               
            if(reinit){
                $('.grid').isotope('reloadItems');
            }
            $('.voter-column, .info-header').show();
            $('.grid').isotope({              
              itemSelector: '.grid-item',
              percentPosition: true,
              layoutMode: 'fitRows',
              getSortData: {               
                reward:"[data-reward] parseFloat",
              },
              sortBy: 'reward',
              sortAscending: { reward: false }
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
    
// получить награду upvote
function getReward(post_payout, post_rshares, upvote_rshare){    
    return (((upvote_rshare/post_rshares)*post_payout).toFixed(3))*1;
}

// return abs_rshares поста, либо
// суммирует rshares всех апвоутов для поста, если post.mode == 'second_payout'
function getPostShares(post){
    if(post.mode == 'first_payout'){
        return post.abs_rshares;
    } else {
        // если пост находится во втором окне выплат (30дн)
        var sum_curators_rshares = 0;
        post.active_votes.forEach(function(item){
            sum_curators_rshares += item.rshares*1;
        });
        return post.abs_rshares*1 + sum_curators_rshares;
    }
}

// награда за пост
function getPostPayout(post){
    var payout = (post.mode == 'first_payout') ? post.total_pending_payout_value : post.total_payout_value;
    // парсит строку с общей выплатой за пост
    var split_payout = (payout).split(' '); 
    return split_payout[0]*1;
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

// показать хедер с инфой пользователя
function showInfo(){
    if(userData.length > 0){
               
        // получаем gests
        accountGests = userData[0].vesting_shares.split(' ')[0];
        $('#gests').html((accountGests/1000000).toFixed(3));
        $('#voting_power').html((userData[0].voting_power/100).toFixed(2)+'%');
        
        // получаем картинку
        var metadata = JSON.parse(userData[0].json_metadata);
        if(metadata.profile !== undefined){
            if(metadata.profile.profile_image !== undefined){
                $('#main-avatar').attr('style', 'background: url(https://imgp.golos.io/120x120/'+metadata.profile.profile_image+') no-repeat;'); 
            }else{
                $('#main-avatar').attr('style', 'background: url(img/blanc.png)  no-repeat;');
            }
        }else{
            $('#main-avatar').attr('style', 'background: url(img/blanc.png)  no-repeat;');
        }       
     
        $('#reputation').html(getReputation(userData[0].reputation));
        
        // показать общую силу голоса для аккаунта
        if(golosData !== null){
            movementGlobal = golosData.total_vesting_shares.split(' ')[0];
            powerGlobal = golosData.total_vesting_fund_steem.split(' ')[0];
            $('#power').html((powerGlobal * (accountGests / movementGlobal)).toFixed(3));
        }   
        // показать общую силу голоса для аккаунта
        $('#power').html(getPower());
        
        // уровень аккаунта
        $('#level').html('<img src="https://imgp.golos.io/75x60/http://golosboard.com/@'+account+'/level.png"/>');       
        //_d(steem.formatter.vestToSteem(userData[0].reputation));
        showRewardsGrid();       
    }
}

// показать таблицу с прогнозом наград
function showRewardsGrid(){
    if(golosData !== null){
        
        // текущая капитализация голоса
        var current_supply = golosData.current_supply.split(' ')[0];
                
        // вычисляем прирост токенов с учетом инфляции за год
        var total_year_delta = current_supply*inflation_rate/100;
        
        // % доля отложенных голосов пользователя в системе
        var account_power_share = getPower()/current_supply;
        
        // годовая награда всем держателям силы голоса
        var golos_holder_year_rewards = total_year_delta*holder_reward/100;

        // вносим данные в таблицу (по дням, часам итп)
        $('.profit-line-box #year-profit').text((golos_holder_year_rewards*account_power_share).toFixed(3));
        $('.profit-line-box #month-profit').text((golos_holder_year_rewards*account_power_share/12).toFixed(3));
        $('.profit-line-box #week-profit').text((golos_holder_year_rewards*account_power_share/52).toFixed(3));
        $('.profit-line-box #day-profit').text((golos_holder_year_rewards*account_power_share/356).toFixed(3));
        $('.profit-line-box #hour-profit').text((golos_holder_year_rewards*account_power_share/(356*24)).toFixed(3));
        //_d(golos_holder_year_rewards*account_power_share, golos_holder_year_rewards, total_year_delta);
    } 
}

// расчитать силу голоса для аккаунта
function getPower(){
    
    if(golosData !== null){
        movementGlobal = golosData.total_vesting_shares.split(' ')[0];
        powerGlobal = golosData.total_vesting_fund_steem.split(' ')[0];
        return (powerGlobal * (accountGests / movementGlobal)).toFixed(3);        
    }else{
        return 0;
    }    
}

// получить точную (.00) репутацию аккаунта
function getReputation(crude_rep){
    crude_rep = crude_rep+'';    
    if(isNaN(crude_rep)){ crude_rep = 0;}
    var is_negative = crude_rep.charAt(0) === '-';
    // убрать первый символ, если репутация негативная 
    crude_rep = is_negative ? crude_rep.substr(1): crude_rep;
    var out = Math.log10(crude_rep);
    out = Math.max(out - 9, 0); // вычитаем 9, либо 0 если отрицательная
    out = (is_negative ? -1 : 1)*out;
    out = (out * 9) + 25; 
    
    return out.toFixed(2);
}

$('.dev-label').on('click', function(){
    window.open('https://golos.io/@elviento', '_blank');
});

function _d(param){
    if(debug){
        console.log(param);
    }
}   

});