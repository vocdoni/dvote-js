import { JsonFeed } from "../json-feed"


export const JsonFeedTemplate: JsonFeed = {
    version: "1.0",
    title: "My Entity",
    home_page_url: "", // http://www.com
    description: "This is the description",
    feed_url: "", // http://www.com/item.json
    icon: "", // http://www.com/icon.png
    favicon: "", // http://www.com/favicon.ico
    expired: false,

    items: [{
        id: "1234",
        title: "Hello world",
        summary: "This is a placeholder post",
        content_text: "Once upon a time, there was a JSON Feed...",
        content_html: "<p>Once upon a time, there was a JSON Feed...</p>",
        url: "", // http://link.item/1234
        image: "https://source.unsplash.com/random/800x600", // http://www.com/image.jpg
        tags: ["welcome"],
        date_published: "2010-02-07T14:04:00-05:00",
        date_modified: "2010-02-07T14:04:00-05:00",
        author: {
            name: "John Smith",
            url: "http://john.smith"
        }
    }]
}
