<a name="CredView"></a>

## CredView
The CredView is an interface for Graph-aware queries over a CredResult.

For example, if you want to find out all of the flows of cred into or out of a node,
then you need to overlay Cred data on the structure of the Graph. This class makes
such queries convenient.

**Kind**: global class  
<a name="CredView+recompute"></a>

### credView.recompute()
Compute a new CredView, with new params and weights but using the
graph from this CredView.

**Kind**: instance method of [<code>CredView</code>](#CredView)  
