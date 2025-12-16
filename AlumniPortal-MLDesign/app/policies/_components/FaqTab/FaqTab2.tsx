"use client";

import { useEffect, useState } from "react";
import faqrequest from "../../_api-helpers/faq-request";
import { fetchPoliciesFromAzure } from "../../_api-helpers/fetch-policies";
import { useAppDispatch, useAppSelector } from "@/redux-toolkit/hooks";
import { setState as setFaqs } from "@/redux-toolkit/features/faqs";
import FaqAccordian from "./FaqAccordian/FaqAccordian";
import { Button, Spinner, Tabs, Tab, Breadcrumbs, BreadcrumbItem } from "@nextui-org/react";
import { colorsForFaqsCategory } from "../data";
import { useRouter } from "next/navigation";
import React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

type faqsFiles = {
  filename: string;
  filepath: string;
}[];

type Faqs = {
  id: number;
  questions: string;
  answers: string;
  tags: string;
  category: string;
  files: faqsFiles;
}[];

type PolicyFile = {
  filename: string;
  filepath: string;
};

export default function FaqTab2() {
  const faqs = useAppSelector((state) => state.faqs);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("policies");
  const [policyFiles, setPolicyFiles] = useState<PolicyFile[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(true);
  
  const dispatch = useAppDispatch();
  const router = useRouter();
  const employeeLoginState = useAppSelector(
    (state) => state.employeeLoginState
  );

  // Fetch FAQs on mount if not already loaded
  useEffect(() => {
    const fetchFaqs = async () => {
      if (faqs.length === 0) {
        const response = await faqrequest(employeeLoginState, dispatch, router);
        if (response) {
          dispatch(setFaqs(response));
        }
      }
      setLoading(false);
    };

    fetchFaqs();
  }, []);

  // Fetch policy files from Azure on mount
  useEffect(() => {
    const fetchPolicies = async () => {
      setPoliciesLoading(true);
      const files = await fetchPoliciesFromAzure();
      setPolicyFiles(files);
      setPoliciesLoading(false);
    };

    fetchPolicies();
  }, []);

  // Group FAQs by category
  const categorizedFaqs: { [category: string]: Faqs } = React.useMemo(() => {
    const grouped: { [category: string]: Faqs } = {};
    faqs.forEach((faq) => {
      if (!grouped[faq.category]) {
        grouped[faq.category] = [];
      }
      grouped[faq.category].push(faq);
    });
    return grouped;
  }, [faqs]);

  // Get category keys for FAQs tab (exclude static resources)
  const faqCategories = Object.keys(categorizedFaqs);

  // Toggle category selection
  const handleCategoryClick = (category: string) => {
    setSelectedKey(selectedKey === category ? "" : category);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <>
    {/* 🔴 CHANGED: Added responsive padding container */}
    <div className="w-full px-4 md:px-8">
      {/* 🔴 CHANGED: Removed custom padding classes, simplified to default NextUI styling */}
      <Breadcrumbs className="mb-4">
        <BreadcrumbItem href="/actions">Home</BreadcrumbItem>
        <BreadcrumbItem href="/policies">Policies</BreadcrumbItem>
      </Breadcrumbs>
      
      <Tabs
        aria-label="FAQ Navigation"
        selectedKey={activeTab}
        onSelectionChange={(key) => {
          setActiveTab(key as string);
          setSelectedKey(""); // Reset category selection when switching tabs
        }}
        variant="underlined"
        color="danger"
        classNames={{
          /* 🔴 CHANGED: Removed pl-8, added responsive gap, kept border-b */
          tabList: "gap-4 md:gap-6 w-full relative rounded-none p-0 border-b border-divider",
          cursor: "w-full bg-[#E53526]",
          /* 🔴 CHANGED: Added responsive height and padding */
          tab: "max-w-fit px-3 md:px-4 h-10 md:h-12",
          tabContent: "group-data-[selected=true]:text-[#E53526] text-base font-medium"
        }}
      >
        {/* Tab 1: Policies */}
        <Tab key="policies" title="Policies">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            /* 🔴 CHANGED: Added responsive vertical padding */
            className="py-4 md:py-8"
          >
            {/* 🔴 CHANGED: Added horizontal padding for mobile */}
            <div className="max-w-4xl mx-auto px-4">
              {/* 🔴 CHANGED: Added responsive text size and margin */}
              <h2 className="text-xl md:text-2xl font-semibold mb-6 md:mb-8 text-center text-gray-800">
                Available Documents
              </h2>
              
              {/* Loading State */}
              {policiesLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Spinner size="lg" />
                </div>
              ) : policyFiles.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  No policy documents available
                </div>
              ) : (
                /* 🔴 CHANGED: Replaced flex with CSS Grid for better mobile layout */
                <div className="flex flex-wrap justify-center gap-4 md:gap-6">
                  {policyFiles.map((file, index) => (
                    <Link
                      key={index}
                      href={file.filepath}
                      target="_blank"
                      rel="noopener noreferrer"
                      /* 🔴 CHANGED: Added responsive gap and padding */
                      className="flex flex-col items-center gap-2 md:gap-3 p-4 md:p-6 hover:bg-gray-50 rounded-lg transition-all hover:shadow-md border border-gray-200 w-[160px] md:w-[180px] min-h-[160px]"
                    >
                      {/* Document Icon SVG */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#E53526"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        /* 🔴 CHANGED: Added responsive icon size */
                        className="w-10 h-10 md:w-12 md:h-12"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                      {/* 🔴 CHANGED: Added responsive text size and line-clamp for overflow */}
                         <span className="text-xs md:text-sm font-medium text-center text-gray-700 hover:text-[#E53526] transition-colors line-clamp-3">
                        {file.filename}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </Tab>

        {/* Tab 2: FAQs */}
        <Tab key="faqs" title="FAQs">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            /* 🔴 CHANGED: Added responsive padding for vertical and horizontal */
            className="py-4 md:py-8 px-4"
          >
            {/* Empty State */}
            {/* {!selectedKey && (
              <div className="text-center text-gray-500 py-12">
                Select a category below to view FAQs
              </div>
            )} */}
            {/* Category Buttons with Inline Accordions */}
            {/* 🔴 CHANGED: Added responsive gap */}
            <div className="flex flex-col gap-4 md:gap-6 max-w-4xl mx-auto">
              {faqCategories.map((category) => (
                <div key={category} className="flex flex-col gap-4">
                  <Button
                    onClick={() => handleCategoryClick(category)}
                    /* 🔴 CHANGED: Added responsive height and text size */
                    className={`w-full h-12 md:h-16 text-base md:text-lg font-medium transition-all ${
                     selectedKey === category
                       ? "bg-[#E53526] text-white border-2 border-[#E53526]"
                       : "bg-gray-100 text-gray-800 border-2 border-transparent hover:border-gray-300"
                   }`}
                   variant={selectedKey === category ? "solid" : "flat"}
                 >
                   {category}
                 </Button>

                  {/* Accordion appears directly under button */}
                  <AnimatePresence>
                    {selectedKey === category && categorizedFaqs[category] && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <FaqAccordian
                          items={categorizedFaqs[category].map((faq) => ({
                            ariaLabel: faq.questions,
                            title: <span className="text-base font-semibold">{faq.questions}</span>,
                           content: (
                              <div
                                className="text-sm text-gray-700"
                                dangerouslySetInnerHTML={{ __html: faq.answers }}
                              />
                            ),
                            files: faq.files || [],
                         }))}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
               ))}
             </div>
          </motion.div>
        </Tab>
      </Tabs>
    </div>
    </>
  );
}