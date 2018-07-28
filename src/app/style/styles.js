export default {
  header: {
    color: "#1297A1",
    fontFamily: "Roboto Condensed",
  },
  body: {
    padding: "0 100px",
    flex: "3",
  },
  nav: {
    height: "60px",
    padding: "20px 100px",
  },
  navItem: {
    display: "inline-block",
  },
  navList: {
    listStyle: "none",
    paddingLeft: "0",
    margin: "0",
    display: "flex",
  },
  navLink: {
    color: "#3EBEC7",
    fontFamily: "Roboto Condensed",
    fontSize: "18px",
    textDecoration: "none",
  },
  navLinkHover: {
    ":hover": {
      color: "#1297A1",
      textDecoration: "underline",
    },
    ":focus": {
      color: "#1297A1",
      textDecoration: "underline",
    },
  },
  navItemLeft: {
    flex: "1",
  },
  navItemRight: {
    marginLeft: "20px",
  },
  logoImg: {
    height: "20px",
  },
  ghLogo: {
    height: "20px",
    width: "20px",
    fill: "#3EBEC7",
  },
  ghLogoHover: {
    ":hover": {
      fill: "#1297A1",
    },
    ":focus": {
      fill: "#1297A1",
    },
  },
  drawer: {
    flex: "1",
    backgroundColor: "#d3d3d3",
    padding: "20px",
    color: "#ffffff",
  },
};
