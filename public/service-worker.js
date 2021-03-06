importScripts('/src/js/idb.js');
importScripts('/src/js/indexedDB.js');

var CACHE_STATIC = 'static-v12.2';
var CACHE_DYNAMIC = 'dynamic-v10.2';

self.addEventListener('install', function(event){
    console.log('[SW] 安裝(Install) Service Worker!',event);
    event.waitUntil(
      caches.open(CACHE_STATIC)
        .then(function(cache){
            console.log('[SW] ');
            // cache.add('/'); //cache 路徑
            // cache.add('/index.html');
            // cache.add('/src/js/app.js'); 
            // cache.add('/src/css/app.css');
            cache.addAll([
                '/',
                '/index.html',
                '/offlinePage.html',
                '/src/js/app.js',
                '/src/js/idb.js',
                '/src/js/indexedDB.js',
                '/src/js/post.js',
                '/src/js/material.min.js',
                '/src/css/material.blue-red.min.css',
                '/src/css/app.css',
                '/src/images/demo.jpg',
                'https://fonts.googleapis.com/css?family=Roboto:400,700',
                'https://fonts.googleapis.com/icon?family=Material+Icons'
            ]);   
        })  
    ); 
});

self.addEventListener('activate', function(event){
    console.log('[SW] 觸發(Activate) Service Worker!',event);
    // caches.open('static').then(function(cache){
    //     cache.keys().then(function(keys){
    //         keys.forEach(function(request,index, array) {
    //             cache.delete(request);
    //         });
    //     });
    // })
    event.waitUntil(
        caches.keys()
            .then(function(keys){
                return Promise.all(keys.map(function(key){
                    if(key !== CACHE_STATIC &&
                        key !== CACHE_DYNAMIC){
                            console.log('[SW] 刪除舊的快取');
                            return caches.delete(key);
                        }
                        //如果 map不到就回傳null
                }));
            })
    );
    return self.clients.claim();
});

// self.addEventListener('fetch', function(event){
//     // console.log('[SW] 抓資料(Fetch)!',event);
//     // event.respondWith(fetch(event.request));
//     event.respondWith(
//         caches.match(event.request)
//             .then(function(response){
//                 //抓不到會拿到 null
//                 if(response){
//                     return response;
//                 }else{
//                     return fetch(event.request)
//                         .then(function(res){
//                             caches.open(CACHE_DYNAMIC)
//                                 .then(function(cache){
//                                     cache.put(event.request.url, res.clone());
//                                     return res;
//                                 })
//                         });
//                 }
//             })
//     )
// });

// self.addEventListener('fetch', function(event){
//     console.log('Cache only!');
//     event.respondWith(
//         caches.match(event.request)
//     );
// });

// self.addEventListener('fetch', function(event){
//     console.log('Network only!');
//     event.respondWith(
//         fetch(event.request)
//     );
// });

// self.addEventListener('fetch', function(event){
//     console.log('Network with Cache Fallback');
//     event.respondWith(
//         fetch(event.request)
//         .then(function(response){
//             return caches.open(CACHE_DYNAMIC)
//                     .then(function(cache){
//                         cache.put(event.request.url, response.clone());
//                         return response;
//                     })
//         })
//         .catch(function(err){
//             return caches.match(event.request);
//         })      
//     );
// });

// self.addEventListener('fetch', function(event){
//     console.log('動態快取網路資源',event);
//     event.respondWith(
//         caches.open(CACHE_DYNAMIC)
//             .then(function(cache){
//                 return fetch(event.request)
//                         .then(function(response){
//                             cache.put(event.request, response.clone());
//                             return response;
//                         });
//             })      
//     );
// });

self.addEventListener('fetch', function(event){
    console.log('url:',event.request.url);
    var url = 'https://days-pwas-practice.firebaseio.com/article.json';
    if(-1 <　event.request.url.indexOf(url)){
        event.respondWith(     
            fetch(event.request)
                .then(function(response){
                    var copyRes = response.clone();
                    clearAllData('article')
                        .then(function(){
                            return copyRes.json();
                        })
                        .then(function(data){
                            console.log('copyRes.json()',data);
                            for(var key in data){
                                console.log('key',key);
                                writeData('article',data[key]);
                            }
                        });
                    return response;
                })
        );
    } else{
        event.respondWith(
             caches.match(event.request)
                .then(function(response){
                    if(response){
                        return response;
                    }else{
                        return fetch(event.request)
                            .then(function(res){
                                return caches.open(CACHE_DYNAMIC)
                                    .then(function(cache){
                                            cache.put(event.request.url, res.clone());
                                            return res;
                                    })
                                    .catch(function(err){
                                        return caches.open(CACHE_STATIC)
                                            .then(function(cahce){
                                                return caches.match('/ErrorPage.html');
                                            });
                                    });                                   
                            });
                    }
                })
                .catch(function(err){
                    return caches.open(CACHE_STATIC)
                            .then(function(cache){
                                return cache.match('/offlinePage.html');
                            });
                })
        );
    }
});

self.addEventListener('sync', function(event){
    console.log('[SW] Background syncing', event);
    if(event.tag === 'sync-new-post') {
        console.log('抓到TAG-POST 表單');
        event.waitUntil(
            readAllData('sync-posts')
                .then(function(data){
                    for(var post of data)
                    {
                        fetch('https://us-central1-days-pwas-practice.cloudfunctions.net/storePostData',{
                            method: 'POST',
                            headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                            },
                            body: JSON.stringify({
                                id: post.id,
                                title: post.title,
                                location: post.location,
                                content: post.content,
                                image: post.image
                            })
                        })
                        .then(function (res) {
                            console.log('送出表單',res);
                            if(res.ok){
                                deleteArticleData('sync-posts',post.id);
                            }
                        })
                        .catch(function(err){
                            console.log('POST表單失敗!',err);
                        });
                    }
                      
                })
        );
    }
});

self.addEventListener('notificationclick', function(event) {
    var notification = event.notification;
    var action = event.action;
    console.log(event);
    console.log(notification);
    
    if(action === 'confirm') {
        console.log('使用者點選確認');
        notification.close();
    } else {
        console.log(action);
        event.waitUntil(
            clients.matchAll()
                .then(function(clis){
                    var client = clis.find(function(c){
                        return c.visibilityState === 'visible';
                    });

                    if (client !== undefined) {
                        client.navigate(notification.data.url);
                        client.focus();
                    }else{
                        clients.openWindow(notification.data.url);
                    }
                })
        )
        console.log('點選通知，導向',notification.data.url);
    }
});

//滑掉通知、關掉通知無視選項
self.addEventListener('notificationclose', function(event){
    console.log('使用者沒興趣',event);
});

self.addEventListener('push', function(event){
    console.log('收到推播訊息', event);

    var contentObj = {title: '新訊息', content: '預設訊息，會被伺服器訊息覆蓋', url: 'http://網址'};
    if(event.data){
        contentObj = JSON.parse(event.data.text());
    }

    var options = {
        body: contentObj.content,
        icon: '/src/images/icons/demo-icon96.png',
        lang: 'zh-Hant', //BCP 47
        vibrate: [100, 50, 200],
        badge: '/src/images/icons/demo-icon96.png',
        tag: 'first-notification',
        data: {
            url: contentObj.url
        }
    };
    event.waitUntil(
        self.registration.showNotification(contentObj.title, options)
    );
});