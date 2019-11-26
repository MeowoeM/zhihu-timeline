
var followingPage = "https://www.zhihu.com/people/Meow0_o/following";
var storedFollowingListKey = 'followingList'

// follower page number
var myFunctions = window.myFunctions = {};
var followingList = window.followingList = [];

if(window.location.href == 'https://www.zhihu.com/'){
    generateTimeLine();
}
else{
    console.log ("iframe start: " + window.location.href);
    // wait for the AJAXed-in content...
    waitForKeyElements ('#Profile-following', function(jNode){
        window.top.postMessage (jNode.html(), "*");
    });
};

async function generateTimeLine(){
    const followingList = await getFollowingList();
    var timeLineCache = new Array(followingList.length);
    for(let i = 0; i < followingList.length; i++){
        // TODO: xhr only returns 2 latest activities. to handle ajaxed content
        timeLineCache[i] = getUserTimeLine(followingList[i]);
    };

    var timeLine = [];
    for(let i = 0; i < followingList.length; i++){
        timeLine = timeLine.concat(await timeLineCache[i]);
    };

    timeLine.sort(function(a, b){
        console.log(a)
        const time1 = parseTime(a.getElementsByClassName('ActivityItem-meta')[0].childNodes[1].innerHTML);
        const time2 = parseTime(b.getElementsByClassName('ActivityItem-meta')[0].childNodes[1].innerHTML);
        return time1 - time2
    });

    // remove official time line
    $('div.TopstoryMain').remove();

    // append scraped time line
    for(let i = 0; i < timeLine.length; i++){
        $('div.TopstoryMain').append(timeLine[i]);
    };
};

function parseTime(timeString){
    var time = {y: 0, M: 0, d: 0, h: 0, m: 0, s: 0};
    var cnDict = {'年前': 'y', '个月前': 'M', '天前': 'd', '小时前': 'h', '分钟前': 'm', '秒前': 's'};
    var result = timeString.match(/(\d+) (年前|个月前|天前|分钟前|秒前)/);
    time[cnDict[result[2]]] = parseInt(result[1]);

    return new Date(time.y, time.M, time.d, time.h, time.m, time.s, 0)
};

// fetch the activities of an user
// TODO: xhr only returns 2 latest activities. to handle ajaxed content
function getUserTimeLine(userUrl){
    return new Promise(function(resolve, reject){
        GM_xmlhttpRequest({
            method: "GET",
            url:    'https://www.zhihu.com/people/luo-tian-tian-31/activities',
            onload: function (response) {
                var parser = new DOMParser ();
                /* IMPORTANT!
                   1) For Chrome, see
                   https://developer.mozilla.org/en-US/docs/Web/API/DOMParser#DOMParser_HTML_extension_for_other_browsers
                   for a work-around.

                   2) jQuery.parseHTML() and similar are bad because it causes images, etc., to be loaded.
                */
                var doc = parser.parseFromString (response.responseText, "text/html");
                resolve(doc.getElementById('Profile-activities').getElementsByClassName('List-item'));
            },
            onerror: function(e){
                reject(Error('**** error ', e));
            },
            onabort: function(e){
                reject(Error('**** abort ', e));
            },
            ontimeout: function (e) {
                reject(Error('**** timeout ', e));
            }
        });
    });
};

function getFollowingPageList(){
    return new Promise(function(resolve, reject){
        GM_xmlhttpRequest({
            method: "GET",
            url:    followingPage,
            onload: function (response) {
                var parser = new DOMParser ();
                /* IMPORTANT!
                   1) For Chrome, see
                   https://developer.mozilla.org/en-US/docs/Web/API/DOMParser#DOMParser_HTML_extension_for_other_browsers
                   for a work-around.

                   2) jQuery.parseHTML() and similar are bad because it causes images, etc., to be loaded.
                */
                var doc = parser.parseFromString (response.responseText, "text/html");
                var followingPageNum = parseInt(doc.getElementsByClassName ("Button PaginationButton PaginationButton-next Button--plain")[0].previousSibling.textContent);

                var followingPageList = []
                for(let i = 0; i < followingPageNum; i++){
                    followingPageList.push("https://www.zhihu.com/people/Meow0_o/following?page=" + (i + 1))
                };
                // console.log(followingPageList);
                resolve(followingPageList);
            },
            onerror: function(e){
                reject(Error('**** error ', e));
            },
            onabort: function(e){
                reject(Error('**** abort ', e));
            },
            ontimeout: function (e) {
                reject(Error('**** timeout ', e));
            }
        });
    });
};

// extract following url from the div.List of received event data
function extractUrlList(event) {
    var parser=new DOMParser();
    var receivedData=parser.parseFromString(event.data, "text/html");

    var aList = receivedData.getElementsByClassName("UserLink-link");
    // console.log(aList);
    var followingUrlList = new Array(aList.length / 2);

    for(let i = 0; i < aList.length / 2; i++){
        followingUrlList[i] = (aList[2 * i].href);
    };

    // console.log(followingUrlList[0]);
    return followingUrlList
}

function getFollowingThisPage(url, index){
    return new Promise(function(resolve, reject){
        // inform the user.
        console.log('fetching results from '+ url);

        // setup to process messages from the GM instance running on the iFrame:
        window.addEventListener ("message", function receiveMessage(event){
            resolve(extractUrlList(event))
        }, false);

        // load the resource site in a hidden iframe.
        $("body").before ('<iframe src="'+ url +'" id="gmIframe' + index + '" style="width:0;height:0;border:0; border:none;"></iframe>');
    });
};

function getFollowingList(){
    return new Promise(function(resolve, reject){
        chrome.storage.local.get([storedFollowingListKey], function(followingList){
            // if no following list stored, initialize it
            if(typeof followingList == 'undefined'){
                console.log('no stored following list found,.')
                resolve(getFollowingListFromScratch());
            }
            // update the existing following list
            else{
                console.log('stored following found.')
                resolve(updateFollowingList(followingList))
            };
        });
    });
};

async function updateFollowingList(followingList){
    console.log('updating following list.')
    var latestFollowing = await followingList[0];
    const followingPageList = await getFollowingPageList();
    var listToUpdate = []
    for(let i = 0; i < followingPageList.length; i++){
        var followingListThisPage = await getFollowingThisPage(followingPageList[i], i);
        for(let j = 0; j < followingListThisPage.length; j++){
            if(followingListThisPage[j] == latestFollowing){
                listToUpdate = listToUpdate.concat(followingList)
                chrome.storage.local.set(
                    {storedFollowingListKey: JSON.stringify(listToUpdate)},
                    function(){console.log('update:' + listToUpdate);}
                )
                return listToUpdate
            }
            else{
                listToUpdate.push(followingListThisPage[j]);
            };
        };
    };
    chrome.storage.local.set(
        {storedFollowingListKey: JSON.stringify(listToUpdate)},
        function(){console.log('update:' + listToUpdate);}
    )
    return listToUpdate
};

// scrape the whole following list if no stored one is found
async function scrapeFollowingList(){
    console.log('scraping following list')
    const followingPageList = await getFollowingPageList();
    // console.log(followingPageList[1]);
    var followingCache = window.followingCache = new Array(followingPageList.length);
    // TODO: parallelize postMessage
    for(let i = 0; i < followingPageList.length; i++){
        followingCache[i] = await getFollowingThisPage(followingPageList[i], i);
    };

    //for(let i = 0; i < followingPageList.length; i++){
    //    await followingCache[i];
    //};
    //followingCache[2].then(data => {
    //    console.log(data);
    //});

    // concatenate followingCache into a 1d array
    var followingList = [];
    for(let i = 0; i < followingPageList.length; i++){
        followingList = followingList.concat(followingCache[i]);
    };

    GM_setValue(storedFollowingListKey, JSON.stringify(followingList));
    console.log('following list generated')
    return followingList
    //console.log(followingNameList);
    //console.log(JSON.stringify(followingNameList))
};

//    getFollowerPageNum(followingUrl).then(function(response){
//        GM_xmlhttpRequest({
//            method: "GET",
//            url:    "https://www.zhihu.com/people/Meow0_o/following?page=1",
//            onload: function (requeset) {
//                var parser = new DOMParser ();
//                /* IMPORTANT!
//                       1) For Chrome, see
//                       https://developer.mozilla.org/en-US/docs/Web/API/DOMParser#DOMParser_HTML_extension_for_other_browsers
//                       for a work-around.
//
//                       2) jQuery.parseHTML() and similar are bad because it causes images, etc., to be loaded.
//                    */
//                var doc = parser.parseFromString (requeset.responseText, "text/html");
//                var criticTxt = doc.getElementsByClassName("UserLink-link")[1].text;
//
//                alert(criticTxt);
//            },
//            onerror: function(e){
//                console.log(Error('**** error ', e));
//            },
//            onabort: function(e){
//                console.log(Error('**** abort ', e));
//            },
//            ontimeout: function (e) {
//                console.log(Error('**** timeout ', e));
//            }
//        });
//    });