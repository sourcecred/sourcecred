<a name="MockFetcher"></a>

## MockFetcher
A class which we can use to store and retrieve data which will act like
Discourses' internal data structure. We can use this to mock data for tests
and implement the Fetcher on top of.

It requires you to add data in the same order as you would on an actual forum.
So to create a post, first a topic should exist to post in.
Creating a topic also creates an opening post.
To add a topic to a category, first you must create it.
Creating a category also creates a category definition topic.

**Kind**: global class  

* [MockFetcher](#MockFetcher)
    * [.addCategory()](#MockFetcher+addCategory)
    * [.addTopic()](#MockFetcher+addTopic)
    * [.addPost()](#MockFetcher+addPost)
    * [.addLike()](#MockFetcher+addLike)
    * [.editPost()](#MockFetcher+editPost)
    * [.deletePost()](#MockFetcher+deletePost)

<a name="MockFetcher+addCategory"></a>

### mockFetcher.addCategory()
Adds a new Category.
This will create a category definition topic as well.
The definition topic will create an opening post.

Note: does not have any perception of sub-categories. None of the current
fetcher methods make the distinction so supporting it here is unnecessary.

**Kind**: instance method of [<code>MockFetcher</code>](#MockFetcher)  
<a name="MockFetcher+addTopic"></a>

### mockFetcher.addTopic()
Adds a new Topic.
The topic will create an opening post.

Note: to set a categoryId, that category must be added first.

**Kind**: instance method of [<code>MockFetcher</code>](#MockFetcher)  
<a name="MockFetcher+addPost"></a>

### mockFetcher.addPost()
Adds a new Post.

Note: a Topic to add this Post to must be added first.

**Kind**: instance method of [<code>MockFetcher</code>](#MockFetcher)  
<a name="MockFetcher+addLike"></a>

### mockFetcher.addLike()
Adds a LikeAction.

Note: a Post to add this LikeAction to must be added first.

**Kind**: instance method of [<code>MockFetcher</code>](#MockFetcher)  
<a name="MockFetcher+editPost"></a>

### mockFetcher.editPost()
Edits a post.

Only supports a limited range of edits, which is expressed by the
PostEdits type. Other operations would cause complex consistency
issues. Like moving to a different topic.

**Kind**: instance method of [<code>MockFetcher</code>](#MockFetcher)  
<a name="MockFetcher+deletePost"></a>

### mockFetcher.deletePost()
Deletes a post.

**Kind**: instance method of [<code>MockFetcher</code>](#MockFetcher)  
