/* ===================================
   Strength Control Power
   Main JavaScript
=================================== */


// Wait until page loads

document.addEventListener(
    "DOMContentLoaded",
    function () {



    /* --------------------------------
       Active Navigation Highlight
    -------------------------------- */


    const currentPage =
        window.location.pathname
        .split("/")
        .pop();



    const navLinks =
        document.querySelectorAll(
            "nav a"
        );



    navLinks.forEach(
        function(link) {


            const linkPage =
                link
                .getAttribute("href");



            if (
                linkPage === currentPage
            ) {

                link.classList.add(
                    "active"
                );

            }


        }
    );





    /* --------------------------------
       Smooth Scrolling
    -------------------------------- */


    const scrollLinks =
        document.querySelectorAll(
            'a[href^="#"]'
        );



    scrollLinks.forEach(
        function(link) {


            link.addEventListener(
                "click",
                function(event) {


                    const target =
                        document.querySelector(
                            this.getAttribute(
                                "href"
                            )
                        );


                    if(target){

                        event.preventDefault();


                        target.scrollIntoView(
                            {
                                behavior:
                                "smooth"
                            }
                        );

                    }


                }
            );


        }
    );







    /* --------------------------------
       Fade-in Animation
    -------------------------------- */


    const sections =
        document.querySelectorAll(
            "section"
        );



    const observer =
        new IntersectionObserver(
            function(entries){


                entries.forEach(
                    function(entry){


                        if(
                            entry.isIntersecting
                        ){


                            entry.target
                            .classList
                            .add(
                                "show"
                            );


                        }


                    }
                );


            },
            {
                threshold:0.15
            }
        );



    sections.forEach(
        function(section){

            observer.observe(
                section
            );

        }
    );






    /* --------------------------------
       Contact Form Validation
    -------------------------------- */


    const form =
        document.querySelector(
            "form"
        );



    if(form){


        form.addEventListener(
            "submit",
            function(event){


                const email =
                    document
                    .getElementById(
                        "email"
                    );



                if(
                    email &&
                    !email.value.includes("@")
                ){


                    event.preventDefault();


                    alert(
                        "Please enter a valid email address."
                    );


                }


            }
        );


    }





    }
);
